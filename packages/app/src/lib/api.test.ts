import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
    API_URL,
    ApiError,
    READ_DEADLINE_MS,
    RETRY_PAUSE_MS,
    UPLOAD_DEADLINE_MS,
    WRITE_DEADLINE_MS,
    adminApi,
    api,
    fetchAll,
    onLaunchOutdated,
    onWebSessionExpired,
    scopedKey,
    setAdminBot,
    setShop,
    setWebSession,
} from "./api.js"

function reply(status: number, body?: unknown): Response {
    return new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

/** Every call its own answer, as a real `fetch` gives: a body is read only once. */
function fresh(status: number, body?: unknown): () => Promise<Response> {
    return (): Promise<Response> => Promise.resolve(reply(status, body))
}

describe("api client", () => {
    const fetchMock = vi.fn<typeof fetch>()

    beforeEach(() => {
        vi.stubGlobal("window", { Telegram: { WebApp: { initData: "signed" } } })
        vi.stubGlobal("fetch", fetchMock)
        setShop("osh-markaz")
    })

    afterEach(() => {
        fetchMock.mockReset()
        vi.unstubAllGlobals()
    })

    it("an expired browser session sends the owner back to sign in", async () => {
        const expired = vi.fn()
        onWebSessionExpired(expired)
        fetchMock.mockImplementation(fresh(401, { error: { code: "UNAUTHORIZED", message: "" } }))
        await expect(api.me()).rejects.toBeInstanceOf(ApiError)
        expect(expired).not.toHaveBeenCalled()
        setWebSession("session-token")
        await expect(api.me()).rejects.toBeInstanceOf(ApiError)
        expect(expired).toHaveBeenCalledOnce()
        setWebSession(null)
        onWebSessionExpired(null)
    })

    it("a refusal of a day-old Telegram signature asks for a new opening", async () => {
        const outdated = vi.fn()
        onLaunchOutdated(outdated)
        fetchMock.mockImplementation(fresh(401, { error: { code: "UNAUTHORIZED", message: "" } }))
        const signedAgo = (seconds: number): string =>
            `auth_date=${Math.floor(Date.now() / 1000) - seconds}&hash=abc`
        // Refused for another reason while the signature is fresh: not this.
        vi.stubGlobal("window", { Telegram: { WebApp: { initData: signedAgo(60) } } })
        await expect(api.me()).rejects.toMatchObject({ status: 401 })
        expect(outdated).not.toHaveBeenCalled()
        vi.stubGlobal("window", { Telegram: { WebApp: { initData: signedAgo(25 * 3600) } } })
        await expect(api.me()).rejects.toMatchObject({ status: 401 })
        expect(outdated).toHaveBeenCalledOnce()
        // A browser session has its own way back (sign in again).
        setWebSession("session-token")
        await expect(api.me()).rejects.toMatchObject({ status: 401 })
        expect(outdated).toHaveBeenCalledOnce()
        setWebSession(null)
        onLaunchOutdated(null)
    })

    it("sends initData and the shop with every request", async () => {
        fetchMock.mockResolvedValue(reply(200, { id: "c1" }))
        await api.me()
        const [url, init] = fetchMock.mock.calls[0] ?? []
        expect(url).toBe(`${API_URL}/api/me`)
        const headers = new Headers(init?.headers)
        expect(headers.get("X-Telegram-Init-Data")).toBe("signed")
        expect(headers.get("X-Shop")).toBe("osh-markaz")
    })

    it("Zumda Business signs «Mening bizneslarim» and an owner's shop opened from it", async () => {
        fetchMock.mockImplementation(fresh(200, []))
        setShop(null, { via: "business" })
        await api.platform.myShops()
        setShop("osh-markaz", { via: "business" })
        await api.me()
        setShop("osh-markaz", { via: "marketplace" })
        await api.me()
        const headers = fetchMock.mock.calls.map(([, init]) => new Headers(init?.headers))
        expect(headers.map((h) => [h.get("X-Bot"), h.get("X-Shop"), h.get("X-Via")])).toEqual([
            ["business", null, null],
            ["business", "osh-markaz", null],
            [null, "osh-markaz", "marketplace"],
        ])
    })

    it("«Platforma» is signed by Zumda | Platforma, with no shop, apart in the cache", async () => {
        fetchMock.mockImplementation(fresh(200, { admin: true }))
        setAdminBot()
        expect(scopedKey("platform:pending")).toBe("admin|platform:pending")
        await adminApi.me()
        await api.web.login("admin")
        const [url, init] = fetchMock.mock.calls[0] ?? []
        const [loginUrl] = fetchMock.mock.calls[1] ?? []
        expect(url).toBe(`${API_URL}/api/admin/me`)
        const headers = new Headers(init?.headers)
        expect([headers.get("X-Bot"), headers.get("X-Shop")]).toEqual(["admin", null])
        expect(loginUrl).toBe(`${API_URL}/api/admin-web/login`)
        // A shop opened afterwards is signed by its own bot again.
        setShop("osh-markaz")
        await api.me()
        const after = new Headers(fetchMock.mock.calls[2]?.[1]?.headers)
        expect([after.get("X-Bot"), after.get("X-Shop")]).toEqual([null, "osh-markaz"])
    })

    it("sends only product ids and quantities when ordering", async () => {
        fetchMock.mockResolvedValue(reply(201, { id: "o1" }))
        await api.placeOrder({
            items: [{ productId: "p1", quantity: 2 }],
            address: "Mustaqillik 5",
        })
        const init = fetchMock.mock.calls[0]?.[1]
        expect(init?.method).toBe("POST")
        expect(JSON.parse(String(init?.body))).toEqual({
            items: [{ productId: "p1", quantity: 2 }],
            address: "Mustaqillik 5",
        })
    })

    it("returns undefined for 204", async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
        await expect(api.owner.deleteProduct("p1")).resolves.toBeUndefined()
    })

    it("turns the error body into an ApiError with the rule code", async () => {
        fetchMock.mockResolvedValue(
            reply(422, { error: { code: "PHONE_REQUIRED", message: "Phone required" } }),
        )
        const error = await api.placeOrder({ items: [], address: "x" }).catch((e: unknown) => e)
        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({ status: 422, code: "PHONE_REQUIRED" })
    })

    it("reports a network failure as NETWORK", async () => {
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
        await expect(api.shop()).rejects.toMatchObject({ status: 0, code: "NETWORK" })
    })

    it("uploads images as raw bytes with their type", async () => {
        fetchMock.mockResolvedValue(reply(200, { id: "p1" }))
        const image = new Blob(["x"], { type: "image/webp" })
        await api.owner.uploadProductImage("p1", image)
        const init = fetchMock.mock.calls[0]?.[1]
        expect(init?.method).toBe("PUT")
        expect(new Headers(init?.headers).get("Content-Type")).toBe("image/webp")
        expect(init?.body).toBe(image)
    })
})

/** A request whose connection died: it answers nothing until it is aborted. */
function hang(_url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
        )
    })
}

describe("api client: every request ends", () => {
    const fetchMock = vi.fn<typeof fetch>()

    beforeEach(() => {
        vi.useFakeTimers()
        vi.stubGlobal("window", { Telegram: { WebApp: { initData: "signed" } } })
        vi.stubGlobal("fetch", fetchMock)
        setShop("osh-markaz")
    })

    afterEach(() => {
        fetchMock.mockReset()
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    it("a read that hangs ends as NETWORK at its deadline, without a second try", async () => {
        fetchMock.mockImplementation(hang)
        const result = api.shop().catch((e: unknown) => e)
        await vi.advanceTimersByTimeAsync(READ_DEADLINE_MS - 1)
        expect(vi.getTimerCount()).toBe(1)
        await vi.advanceTimersByTimeAsync(1)
        await expect(result).resolves.toMatchObject({ status: 0, code: "NETWORK" })
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    it("a write that hangs ends at its own deadline and is never sent again", async () => {
        fetchMock.mockImplementation(hang)
        const result = api.cancelOrder("o1").catch((e: unknown) => e)
        await vi.advanceTimersByTimeAsync(READ_DEADLINE_MS)
        expect(fetchMock).toHaveBeenCalledOnce()
        await vi.advanceTimersByTimeAsync(WRITE_DEADLINE_MS - READ_DEADLINE_MS)
        await expect(result).resolves.toMatchObject({ code: "NETWORK" })
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    it("a photo has longer: slow 3G still uploads it", async () => {
        fetchMock.mockImplementation(hang)
        const image = new Blob(["x"], { type: "image/webp" })
        const result = api.owner.uploadProductImage("p1", image).catch((e: unknown) => e)
        await vi.advanceTimersByTimeAsync(WRITE_DEADLINE_MS)
        expect(vi.getTimerCount()).toBe(1)
        await vi.advanceTimersByTimeAsync(UPLOAD_DEADLINE_MS - WRITE_DEADLINE_MS)
        await expect(result).resolves.toMatchObject({ code: "NETWORK" })
    })

    it("a read that broke before any answer goes once more and gets it", async () => {
        fetchMock
            .mockRejectedValueOnce(new TypeError("The network connection was lost."))
            .mockResolvedValueOnce(reply(200, { slug: "osh-markaz" }))
        const result = api.shop()
        await vi.advanceTimersByTimeAsync(RETRY_PAUSE_MS)
        await expect(result).resolves.toEqual({ slug: "osh-markaz" })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("a write that broke is not sent again: the server may have done it", async () => {
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
        const result = api.cancelOrder("o1").catch((e: unknown) => e)
        await vi.advanceTimersByTimeAsync(RETRY_PAUSE_MS)
        await expect(result).resolves.toMatchObject({ code: "NETWORK" })
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    it("a body cut off on the way is a failure, never an empty success", async () => {
        const cut = new ReadableStream<Uint8Array>({
            start(controller): void {
                controller.error(new TypeError("network error"))
            },
        })
        fetchMock.mockResolvedValue(new Response(cut, { status: 200 }))
        const result = api.shop().catch((e: unknown) => e)
        await vi.advanceTimersByTimeAsync(RETRY_PAUSE_MS)
        await expect(result).resolves.toMatchObject({ code: "NETWORK" })
    })

    it("an answer in time leaves no timer behind", async () => {
        fetchMock.mockResolvedValue(reply(200, { slug: "osh-markaz" }))
        await expect(api.shop()).resolves.toEqual({ slug: "osh-markaz" })
        expect(vi.getTimerCount()).toBe(0)
    })
})

describe("fetchAll", () => {
    it("loads every page until the total is reached", async () => {
        const pages = [[1, 2], [3, 4], [5]]
        const load = vi.fn((page: number) =>
            Promise.resolve({ data: pages[page - 1] ?? [], meta: { page, limit: 2, total: 5 } }),
        )
        await expect(fetchAll(load)).resolves.toEqual([1, 2, 3, 4, 5])
        expect(load).toHaveBeenCalledTimes(3)
    })

    it("stops on an empty page even if the total says more", async () => {
        const load = vi.fn((page: number) =>
            Promise.resolve({ data: page === 1 ? [1] : [], meta: { page, limit: 1, total: 9 } }),
        )
        await expect(fetchAll(load)).resolves.toEqual([1])
        expect(load).toHaveBeenCalledTimes(2)
    })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { API_URL, ApiError, api, fetchAll, setShop } from "./api.js"

function reply(status: number, body?: unknown): Response {
    return new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })
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

    it("sends initData and the shop with every request", async () => {
        fetchMock.mockResolvedValue(reply(200, { id: "c1" }))
        await api.me()
        const [url, init] = fetchMock.mock.calls[0] ?? []
        expect(url).toBe(`${API_URL}/api/me`)
        const headers = new Headers(init?.headers)
        expect(headers.get("X-Telegram-Init-Data")).toBe("signed")
        expect(headers.get("X-Shop")).toBe("osh-markaz")
    })

    it("Zumda Biznes signs «Mening bizneslarim» and an owner's shop opened from it", async () => {
        fetchMock.mockResolvedValue(reply(200, []))
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

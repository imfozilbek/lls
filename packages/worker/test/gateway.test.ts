import { afterEach, describe, expect, it, vi } from "vitest"

import {
    HttpTelegramGateway,
    RETRY_AFTER_MAX_SECONDS,
    TELEGRAM_API_BASE,
    TelegramApiError,
    escapeHtml,
    telegramApiBase,
} from "../src/telegram/gateway.js"

interface Call {
    url: string
    body: Record<string, unknown>
}

function fakeFetch(result: unknown, ok = true): { fetcher: typeof fetch; calls: Call[] } {
    const calls: Call[] = []
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
            url: String(input),
            body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        })
        return new Response(
            JSON.stringify(ok ? { ok, result } : { ok, description: "Forbidden" }),
            {
                status: ok ? 200 : 403,
            },
        )
    }) as typeof fetch
    return { fetcher, calls }
}

describe("HttpTelegramGateway", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("calls the global fetch unbound, as workerd requires", async () => {
        // workerd throws "Illegal invocation" when fetch runs with `this` set to another object.
        const strictFetch = vi.fn(function (this: unknown): Promise<Response> {
            if (this !== undefined && this !== globalThis) {
                throw new TypeError("Illegal invocation")
            }
            const result = { id: 7, username: "osh_bot", first_name: "Osh" }
            return Promise.resolve(new Response(JSON.stringify({ ok: true, result })))
        })
        vi.stubGlobal("fetch", strictFetch)
        const bot = await new HttpTelegramGateway().getMe("7:token")
        expect(bot.username).toBe("osh_bot")
        expect(strictFetch).toHaveBeenCalledOnce()
    })

    it("getMe maps the bot", async () => {
        const { fetcher, calls } = fakeFetch({ id: 7, username: "osh_bot", first_name: "Osh" })
        const bot = await new HttpTelegramGateway(fetcher).getMe("7:token")
        expect(bot).toEqual({ id: 7, username: "osh_bot", firstName: "Osh" })
        expect(calls[0]?.url).toBe("https://api.telegram.org/bot7:token/getMe")
    })

    it("sends HTML messages with keyboards and returns the message id", async () => {
        const { fetcher, calls } = fakeFetch({ message_id: 42 })
        const keyboard = { inline_keyboard: [[{ text: "OK", callback_data: "a" }]] }
        const sent = await new HttpTelegramGateway(fetcher).sendMessage("t", 1, "<b>Hi</b>", {
            keyboard,
        })
        expect(sent.messageId).toBe(42)
        expect(calls[0]?.body).toMatchObject({
            chat_id: 1,
            text: "<b>Hi</b>",
            parse_mode: "HTML",
            reply_markup: keyboard,
        })
    })

    it("sends a picture by URL with an HTML caption and buttons", async () => {
        const { fetcher, calls } = fakeFetch({ message_id: 7 })
        const keyboard = { inline_keyboard: [[{ text: "Open", web_app: { url: "https://a" } }]] }
        await new HttpTelegramGateway(fetcher).sendPhoto(
            "t",
            1,
            "https://app.zumda.shop/welcome/zumda.jpg",
            "<b>Hi</b>",
            { keyboard },
        )
        expect(calls[0]?.url).toBe("https://api.telegram.org/bott/sendPhoto")
        expect(calls[0]?.body).toMatchObject({
            chat_id: 1,
            photo: "https://app.zumda.shop/welcome/zumda.jpg",
            caption: "<b>Hi</b>",
            parse_mode: "HTML",
            reply_markup: keyboard,
        })
    })

    it("sends a video by URL with its cover, size, an HTML caption and buttons", async () => {
        const { fetcher, calls } = fakeFetch({ message_id: 8 })
        const keyboard = { inline_keyboard: [[{ text: "Open", web_app: { url: "https://a" } }]] }
        await new HttpTelegramGateway(fetcher).sendVideo(
            "t",
            1,
            {
                url: "https://app.zumda.shop/welcome/biznes.mp4",
                coverUrl: "https://app.zumda.shop/welcome/biznes-cover.jpg",
                width: 720,
                height: 1280,
                durationS: 47,
            },
            "<b>Hi</b>",
            { keyboard },
        )
        expect(calls[0]?.url).toBe("https://api.telegram.org/bott/sendVideo")
        expect(calls[0]?.body).toEqual({
            chat_id: 1,
            video: "https://app.zumda.shop/welcome/biznes.mp4",
            cover: "https://app.zumda.shop/welcome/biznes-cover.jpg",
            width: 720,
            height: 1280,
            duration: 47,
            supports_streaming: true,
            caption: "<b>Hi</b>",
            parse_mode: "HTML",
            reply_markup: keyboard,
        })
    })

    it("edits, answers callbacks, sets webhook and menu button", async () => {
        const { fetcher, calls } = fakeFetch(true)
        const gateway = new HttpTelegramGateway(fetcher)
        await gateway.editMessage("t", 1, 2, "text")
        await gateway.answerCallback("t", "cb", "Done")
        await gateway.setWebhook("t", "https://w.dev/tg/1", "secret")
        await gateway.setMenuButton("t", "Menu", "https://app.dev/?shop=osh")
        await gateway.setCommands("t", [{ command: "start", description: "Boshlash" }])
        expect(calls.map((c) => c.url.split("/").at(-1))).toEqual([
            "editMessageText",
            "answerCallbackQuery",
            "setWebhook",
            "setChatMenuButton",
            "setMyCommands",
        ])
        expect(calls[4]?.body).toEqual({
            commands: [{ command: "start", description: "Boshlash" }],
        })
        expect(calls[0]?.body).toMatchObject({ reply_markup: { inline_keyboard: [] } })
        expect(calls[2]?.body).toMatchObject({ secret_token: "secret", url: "https://w.dev/tg/1" })
        expect(calls[3]?.body).toMatchObject({
            menu_button: { type: "web_app", web_app: { url: "https://app.dev/?shop=osh" } },
        })
    })

    it("sets the bot's picture as a multipart upload, and both descriptions", async () => {
        const forms: FormData[] = []
        const urls: string[] = []
        const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            urls.push(String(input))
            if (init?.body instanceof FormData) {
                forms.push(init.body)
            }
            return Promise.resolve(new Response(JSON.stringify({ ok: true, result: true })))
        })
        const gateway = new HttpTelegramGateway(fetcher as typeof fetch)
        await gateway.setProfilePhoto("t", new Uint8Array([0xff, 0xd8, 0xff]))
        await gateway.setDescriptions("t", { description: "Long", shortDescription: "Short" })

        expect(urls.map((u) => u.split("/").at(-1))).toEqual([
            "setMyProfilePhoto",
            "setMyDescription",
            "setMyShortDescription",
        ])
        expect(JSON.parse(String(forms[0]?.get("photo")))).toEqual({
            type: "static",
            photo: "attach://avatar",
        })
        const file = forms[0]?.get("avatar")
        expect(file instanceof Blob ? file.type : null).toBe("image/jpeg")
        expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
            description: "Long",
        })
        expect(JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body))).toEqual({
            short_description: "Short",
        })
    })

    it("throws TelegramApiError when Telegram says no", async () => {
        const { fetcher } = fakeFetch(null, false)
        await expect(new HttpTelegramGateway(fetcher).getMe("bad")).rejects.toThrow(
            TelegramApiError,
        )
    })

    it("escapes HTML", () => {
        expect(escapeHtml("<a & b>")).toBe("&lt;a &amp; b&gt;")
    })
})

describe("telegramApiBase", () => {
    it("lets a local stand use a fake Bot API on localhost only", () => {
        expect(telegramApiBase(undefined)).toBe(TELEGRAM_API_BASE)
        expect(telegramApiBase("http://localhost:8081")).toBe("http://localhost:8081")
        expect(telegramApiBase("http://127.0.0.1:8081/x")).toBe("http://127.0.0.1:8081")
        // Anything else could carry bot tokens away: it is ignored.
        expect(telegramApiBase("https://evil.example")).toBe(TELEGRAM_API_BASE)
        expect(telegramApiBase("http://localhost.evil.example")).toBe(TELEGRAM_API_BASE)
        expect(telegramApiBase("https://localhost:8081")).toBe(TELEGRAM_API_BASE)
        expect(telegramApiBase("not a url")).toBe(TELEGRAM_API_BASE)
    })

    it("sends calls to the chosen base", async () => {
        const fetcher = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
            Promise.resolve(new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }))),
        )
        await new HttpTelegramGateway(fetcher as typeof fetch, "http://localhost:8081").sendMessage(
            "7:t",
            1,
            "x",
        )
        expect(fetcher.mock.calls[0]?.[0]).toBe("http://localhost:8081/bot7:t/sendMessage")
    })

    it("waits out a short «Too Many Requests» once; a long one fails at once", async () => {
        const answers = [
            {
                status: 429,
                body: {
                    ok: false,
                    description: "Too Many Requests: retry after 1",
                    parameters: { retry_after: 1 },
                },
            },
            { status: 200, body: { ok: true, result: true } },
        ]
        const fetcher = vi.fn(() => {
            const next = answers.shift() ?? { status: 200, body: { ok: true, result: true } }
            return Promise.resolve(new Response(JSON.stringify(next.body), { status: next.status }))
        })
        const gateway = new HttpTelegramGateway(fetcher as unknown as typeof fetch)
        await gateway.setProfilePhoto("7:t", new Uint8Array([0xff, 0xd8, 0xff]))
        expect(fetcher).toHaveBeenCalledTimes(2)

        const long = vi.fn(() =>
            Promise.resolve(
                new Response(
                    JSON.stringify({
                        ok: false,
                        description: "Too Many Requests: retry after 60",
                        parameters: { retry_after: RETRY_AFTER_MAX_SECONDS + 55 },
                    }),
                    { status: 429 },
                ),
            ),
        )
        await expect(
            new HttpTelegramGateway(long as unknown as typeof fetch).getMe("7:t"),
        ).rejects.toThrow(TelegramApiError)
        expect(long).toHaveBeenCalledOnce()
    })

    it("an outage page or a dropped connection is a Telegram failure, never the token", async () => {
        const outage = (): Promise<Response> =>
            Promise.resolve(new Response("<html>Bad Gateway</html>", { status: 502 }))
        await expect(
            new HttpTelegramGateway(outage as unknown as typeof fetch).getMe("7:t"),
        ).rejects.toThrow("HTTP 502, not a Bot API answer")

        const dropped = (): Promise<Response> =>
            Promise.reject(new TypeError("fetch failed: https://api.telegram.org/bot7:t/getMe"))
        const failure = await new HttpTelegramGateway(dropped as unknown as typeof fetch)
            .getMe("7:t")
            .catch((error: unknown) => error)
        expect(failure).toBeInstanceOf(TelegramApiError)
        expect(String(failure)).not.toContain("7:t")
    })
})

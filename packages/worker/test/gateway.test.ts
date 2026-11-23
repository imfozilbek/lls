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

    it("a message answers a card, may come silently, and its buttons keep colour and copy", async () => {
        const { fetcher, calls } = fakeFetch({ message_id: 43 })
        const keyboard = {
            inline_keyboard: [
                [{ text: "Pul keldi", callback_data: "p:1", style: "success" as const }],
                [{ text: "Karta", copy_text: { text: "4111111111111111" } }],
            ],
        }
        await new HttpTelegramGateway(fetcher).sendMessage("t", 1, "Tayyor", {
            keyboard,
            replyTo: 42,
            silent: true,
        })
        expect(calls[0]?.body).toMatchObject({
            reply_parameters: { message_id: 42, allow_sending_without_reply: true },
            disable_notification: true,
            reply_markup: keyboard,
        })
        // Without them, neither goes.
        await new HttpTelegramGateway(fetcher).sendMessage("t", 1, "Hi")
        expect(calls[1]?.body).not.toHaveProperty("reply_parameters")
        expect(calls[1]?.body).not.toHaveProperty("disable_notification")
    })

    it("deletes the bot's own message; one already gone or too old is no failure", async () => {
        const { fetcher, calls } = fakeFetch(true)
        await new HttpTelegramGateway(fetcher).deleteMessage("t", 1, 42)
        expect(calls[0]?.url).toBe("https://api.telegram.org/bott/deleteMessage")
        expect(calls[0]?.body).toEqual({ chat_id: 1, message_id: 42 })
        const refusing = (description: string): typeof fetch =>
            (async () =>
                new Response(JSON.stringify({ ok: false, description }), {
                    status: 400,
                })) as typeof fetch
        await expect(
            new HttpTelegramGateway(
                refusing("Bad Request: message to delete not found"),
            ).deleteMessage("t", 1, 42),
        ).resolves.toBeUndefined()
        await expect(
            new HttpTelegramGateway(
                refusing("Bad Request: message can't be deleted"),
            ).deleteMessage("t", 1, 42),
        ).resolves.toBeUndefined()
        await expect(
            new HttpTelegramGateway(
                refusing("Forbidden: bot was blocked by the user"),
            ).deleteMessage("t", 1, 42),
        ).rejects.toBeInstanceOf(TelegramApiError)
    })

    it("takes the buttons off a message that stays; one gone or already plain is no failure", async () => {
        const { fetcher, calls } = fakeFetch(true)
        await new HttpTelegramGateway(fetcher).clearButtons("t", 1, 42)
        expect(calls[0]?.url).toBe("https://api.telegram.org/bott/editMessageReplyMarkup")
        expect(calls[0]?.body).toEqual({
            chat_id: 1,
            message_id: 42,
            reply_markup: { inline_keyboard: [] },
        })
        const refusing = (description: string): typeof fetch =>
            (async () =>
                new Response(JSON.stringify({ ok: false, description }), {
                    status: 400,
                })) as typeof fetch
        for (const description of [
            "Bad Request: message is not modified: specified new message content and reply markup are exactly the same",
            "Bad Request: message to edit not found",
        ]) {
            await expect(
                new HttpTelegramGateway(refusing(description)).clearButtons("t", 1, 42),
            ).resolves.toBeUndefined()
        }
    })

    it("streams a video through as one multipart upload, never retried", async () => {
        let form: FormData | undefined
        let calls = 0
        const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
            calls += 1
            form = await new Request("https://t.example/", {
                method: "POST",
                headers: init?.headers,
                body: init?.body,
            }).formData()
            return new Response(JSON.stringify({ ok: true, result: { message_id: 77 } }))
        }) as typeof fetch
        const bytes = new Uint8Array(3000).map((_, i) => i % 251)
        const keyboard = { inline_keyboard: [[{ text: "Buyurtma", url: "https://t.me/b" }]] }
        const sent = await new HttpTelegramGateway(fetcher).sendVideoFile(
            "t",
            -100,
            {
                name: 'po"st.mp4',
                contentType: "video/mp4",
                size: bytes.byteLength,
                body: new Response(bytes).body ?? new ReadableStream(),
            },
            "<b>Fetr</b>",
            { keyboard },
        )
        expect(sent).toEqual({ messageId: 77 })
        expect(calls).toBe(1)
        expect(form?.get("chat_id")).toBe("-100")
        expect(form?.get("caption")).toBe("<b>Fetr</b>")
        expect(form?.get("supports_streaming")).toBe("true")
        expect(JSON.parse(String(form?.get("reply_markup")))).toEqual(keyboard)
        const file = form?.get("video") as File
        expect(file.name).toBe("po_st.mp4")
        expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes)
    })

    it("puts buttons under a post; Telegram's no is the caller's to read", async () => {
        const { fetcher, calls } = fakeFetch(true)
        const keyboard = { inline_keyboard: [[{ text: "Buyurtma", url: "https://t.me/b" }]] }
        await new HttpTelegramGateway(fetcher).setButtons("t", -100, 42, keyboard)
        expect(calls[0]?.url).toBe("https://api.telegram.org/bott/editMessageReplyMarkup")
        expect(calls[0]?.body).toEqual({ chat_id: -100, message_id: 42, reply_markup: keyboard })
        const refusing = (async () =>
            new Response(
                JSON.stringify({ ok: false, description: "Bad Request: message can't be edited" }),
                { status: 400 },
            )) as typeof fetch
        await expect(
            new HttpTelegramGateway(refusing).setButtons("t", -100, 42, keyboard),
        ).rejects.toBeInstanceOf(TelegramApiError)
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
        expect(calls[2]?.body).toMatchObject({
            secret_token: "secret",
            url: "https://w.dev/tg/1",
            // Being made an admin of the shop's channel comes as `my_chat_member`.
            allowed_updates: ["message", "callback_query", "my_chat_member", "channel_post"],
        })
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

    it("a post in the channel: the photo's id comes back, the caption is edited with its buttons", async () => {
        const answers: unknown[] = [
            {
                message_id: 501,
                photo: [{ file_id: "small" }, { file_id: "large" }],
            },
            true,
            3,
        ]
        const bodies: unknown[] = []
        const urls: string[] = []
        const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            urls.push(String(input).split("/").at(-1) ?? "")
            bodies.push(init?.body instanceof FormData ? init.body : JSON.parse(String(init?.body)))
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true, result: answers.shift() })),
            )
        })
        const gateway = new HttpTelegramGateway(fetcher as typeof fetch)
        const keyboard = {
            inline_keyboard: [[{ text: "Buyurtma", url: "https://t.me/b?start=s_x" }]],
        }
        const file = { name: "p.jpg", contentType: "image/jpeg", bytes: new Uint8Array([1]) }
        expect(await gateway.sendPhotoFile("t", -1001, file, "<b>Toy</b>", { keyboard })).toEqual({
            messageId: 501,
            photoFileId: "large",
        })
        await gateway.editCaption("t", -1001, 501, "<b>Toy</b>", { keyboard })
        expect(await gateway.getChatMemberCount("t", -1001)).toBe(3)
        expect(urls).toEqual(["sendPhoto", "editMessageCaption", "getChatMemberCount"])
        expect(bodies[1]).toEqual({
            chat_id: -1001,
            message_id: 501,
            caption: "<b>Toy</b>",
            parse_mode: "HTML",
            reply_markup: keyboard,
        })
    })

    it("a post deleted already counts as removed; one Telegram keeps is refused", async () => {
        const answering = (description: string | null): typeof fetch =>
            (async () =>
                new Response(
                    JSON.stringify(
                        description === null
                            ? { ok: true, result: true }
                            : { ok: false, description },
                    ),
                    { status: description === null ? 200 : 400 },
                )) as typeof fetch
        const remove = (description: string | null): Promise<string> =>
            new HttpTelegramGateway(answering(description)).deleteChannelPost("t", -1001, 7)
        expect(await remove(null)).toBe("removed")
        expect(await remove("Bad Request: message to delete not found")).toBe("removed")
        expect(await remove("Bad Request: message can't be deleted")).toBe("refused")
        await expect(remove("Bad Gateway")).rejects.toBeInstanceOf(TelegramApiError)
        // Leaving a channel the bot is no longer in changes nothing.
        await expect(
            new HttpTelegramGateway(
                answering("Forbidden: bot is not a member of the channel chat"),
            ).leaveChat("t", -1001),
        ).resolves.toBeUndefined()
        await expect(
            new HttpTelegramGateway(answering("Bad Gateway")).leaveChat("t", -1001),
        ).rejects.toBeInstanceOf(TelegramApiError)
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

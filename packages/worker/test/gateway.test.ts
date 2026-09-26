import { afterEach, describe, expect, it, vi } from "vitest"

import { HttpTelegramGateway, TelegramApiError, escapeHtml } from "../src/telegram/gateway.js"

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

    it("edits, answers callbacks, sets webhook and menu button", async () => {
        const { fetcher, calls } = fakeFetch(true)
        const gateway = new HttpTelegramGateway(fetcher)
        await gateway.editMessage("t", 1, 2, "text")
        await gateway.answerCallback("t", "cb", "Done")
        await gateway.setWebhook("t", "https://w.dev/tg/1", "secret")
        await gateway.setMenuButton("t", "Menu", "https://app.dev/?shop=osh")
        expect(calls.map((c) => c.url.split("/").at(-1))).toEqual([
            "editMessageText",
            "answerCallbackQuery",
            "setWebhook",
            "setChatMenuButton",
        ])
        expect(calls[0]?.body).toMatchObject({ reply_markup: { inline_keyboard: [] } })
        expect(calls[2]?.body).toMatchObject({ secret_token: "secret", url: "https://w.dev/tg/1" })
        expect(calls[3]?.body).toMatchObject({
            menu_button: { type: "web_app", web_app: { url: "https://app.dev/?shop=osh" } },
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

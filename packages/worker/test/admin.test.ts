import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import { issueSession } from "../src/web-session.js"

import {
    ADMIN,
    CUSTOMER,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
    TEST_CARD,
    createActiveShop,
    testClient,
} from "./helpers.js"

import type { SentMessage, TestClient } from "./helpers.js"

const DAY_MS = 24 * 60 * 60 * 1000

interface PlatformShop {
    id: string
    name: string
    status: string
    owner: { name?: string; phone?: string }
    payoutCard?: unknown
}

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

describe("«Platforma»: the admins' own bot, Zumda | Platforma (/api/admin)", () => {
    let client: TestClient

    const admin = (): ReturnType<TestClient["as"]> => client.as(ADMIN, { adminBot: true })

    async function apply(): Promise<{ id: string; slug: string }> {
        const response = await client.as(OWNER, { businessBot: true })("/api/platform/shops", {
            method: "POST",
            json: {
                botToken: SHOP_BOT_TOKEN,
                name: "Osh Markaz",
                type: "food",
                deliveryFee: 0,
                payoutCard: TEST_CARD,
            },
        })
        expect(response.status).toBe(201)
        return json(response)
    }

    async function shops(status: string): Promise<PlatformShop[]> {
        const response = await admin()(`/api/admin/shops?status=${status}`)
        expect(response.status).toBe(200)
        return (await json<{ data: PlatformShop[] }>(response)).data
    }

    beforeEach(() => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
    })

    it("Zumda | Business has no «Platforma» any more; Zumda | Platforma opens no shop", async () => {
        const me = await client.as(ADMIN, { businessBot: true })("/api/platform/me")
        expect(me.status).toBe(404)
        const { slug } = await createActiveShop(client)
        const inShop = await client.as(ADMIN, { adminBot: true, shop: slug })(
            "/api/admin/districts",
        )
        expect(inShop.status).toBe(400)
        expect(await json(inShop)).toMatchObject({ error: { code: "ADMIN_NO_SHOP" } })
        // Nor «Mening bizneslarim»: that is Zumda | Business only.
        const businesses = await admin()("/api/platform/shops")
        expect(businesses.status).toBe(403)
    })

    it("an application waits in «Arizalar» with its owner, never with the card", async () => {
        const applied = await apply()
        const [pending] = await shops("pending")
        expect(pending).toMatchObject({ id: applied.id, name: "Osh Markaz", status: "pending" })
        expect(pending?.owner.name).toBe("Rustam")
        expect(pending).not.toHaveProperty("payoutCard")
        expect(await shops("active")).toEqual([])
        expect((await admin()("/api/admin/shops?status=everything")).status).toBe(400)
    })

    it("«Tasdiqlash» connects the bot and tells the owner; «Rad etish» turns a shop off", async () => {
        const applied = await apply()
        const review = (decision: string): Promise<Response> =>
            admin()(`/api/admin/shops/${applied.id}`, { method: "PATCH", json: { decision } })

        const approved = await review("approve")
        expect(approved.status).toBe(200)
        expect(await json(approved)).toMatchObject({
            shop: { status: "active" },
            bot: { connected: true },
        })
        // Connected at the application («Tez orada ochiladi»), and again at the approval.
        expect(client.telegram.webhooks).toHaveLength(2)
        expect(client.telegram.commands.at(-1)).toEqual({
            token: SHOP_BOT_TOKEN,
            commands: [{ command: "start", description: "Boshlash" }],
        })
        const toOwner = client.telegram.sent.filter((m) => m.chatId === OWNER.id).at(-1)
        expect(toOwner?.html).toContain("ishga tushdi")
        expect(toOwner?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toBe(
            "https://business.zumda.test/?mode=business",
        )
        // Approving twice is a business rule, not a crash.
        expect((await review("approve")).status).toBe(422)

        const off = await review("reject")
        expect(await json(off)).toMatchObject({ shop: { status: "disabled" }, bot: null })
        expect((await shops("disabled")).map((s) => s.id)).toEqual([applied.id])
        expect((await review("maybe")).status).toBe(400)
        const unknown = await admin()("/api/admin/shops/nope", {
            method: "PATCH",
            json: { decision: "approve" },
        })
        expect(unknown.status).toBe(404)
    })

    it("a bot Telegram refuses: the shop is approved, the reason comes back", async () => {
        const applied = await apply()
        client.telegram.failWebhooks = true
        const approved = await admin()(`/api/admin/shops/${applied.id}`, {
            method: "PATCH",
            json: { decision: "approve" },
        })
        const body = await json<{ shop: { status: string }; bot: { connected: boolean } }>(approved)
        expect(body.shop.status).toBe("active")
        expect(body.bot.connected).toBe(false)
    })

    it("«Botni qayta ulash» needs an approved shop", async () => {
        const applied = await apply()
        const response = await admin()(`/api/admin/shops/${applied.id}/reconnect`, {
            method: "POST",
        })
        expect(response.status).toBe(422)
        // Only the application's connection: the refused reconnect added none.
        expect(client.telegram.webhooks).toHaveLength(1)
    })

    it("only an admin, only from Zumda | Platforma: every other door is closed", async () => {
        const { id, slug } = await createActiveShop(client)
        const paths: [string, RequestInit & { json?: unknown }][] = [
            ["/api/admin/shops?status=active", {}],
            [`/api/admin/shops/${id}`, { method: "PATCH", json: { decision: "reject" } }],
            [`/api/admin/shops/${id}/reconnect`, { method: "POST" }],
            [`/api/admin/shops/${id}/marketplace`, { method: "PUT", json: { percent: 5 } }],
            ["/api/admin/districts", {}],
        ]
        const doors = [
            client.as(OWNER, { adminBot: true }),
            client.as(STRANGER, { adminBot: true }),
            // The admin, but opened from another bot (Zumda | Business too, where it once was)
            // or inside a shop.
            client.as(ADMIN, {}),
            client.as(ADMIN, { courierBot: true }),
            client.as(ADMIN, { businessBot: true }),
            client.as(ADMIN, { businessBot: true, shop: slug }),
            client.as(ADMIN, { adminBot: true, shop: slug }),
        ]
        for (const door of doors) {
            for (const [path, init] of paths) {
                const status = (await door(path, init)).status
                expect([400, 401, 403], `${path} → ${status}`).toContain(status)
            }
        }
        // A shop bot's token can sign any user id: it never opens «Platforma»; nor does another
        // Zumda bot's signature claiming to come from Zumda | Platforma.
        for (const botToken of [SHOP_BOT_TOKEN, env.BUSINESS_BOT_TOKEN]) {
            const forged = client.as(ADMIN, { botToken, adminBot: true })
            expect((await forged("/api/admin/districts")).status).toBe(401)
        }
        const old = client.as(ADMIN, {
            adminBot: true,
            authDate: new Date(Date.now() - 2 * DAY_MS),
        })
        expect((await old("/api/admin/districts")).status).toBe(401)
        const row = await env.DB.prepare("SELECT status FROM businesses WHERE id = ?")
            .bind(id)
            .first<{ status: string }>()
        expect(row?.status).toBe("active")
    })

    it("in a browser (platform.zumda.shop) only an admin's «Platforma» session opens it", async () => {
        const session = async (
            user: { id: number; first_name: string },
            secret: string,
        ): Promise<string> =>
            (await issueSession({ id: user.id, firstName: user.first_name }, secret, new Date()))
                .token
        const get = async (token: string, bot?: string): Promise<number> =>
            (
                await client.request("/api/admin/districts", {
                    headers: { Authorization: `Bearer ${token}`, ...(bot ? { "X-Bot": bot } : {}) },
                })
            ).status
        const platform = await session(ADMIN, env.ADMIN_SESSION_SECRET)
        expect(await get(platform, "admin")).toBe(200)
        expect(await get(await session(OWNER, env.ADMIN_SESSION_SECRET), "admin")).toBe(403)
        // Zumda | Business's session never opens «Platforma», and «Platforma»'s never opens
        // Zumda | Business.
        const business = await session(ADMIN, env.BUSINESS_SESSION_SECRET)
        expect(await get(business, "admin")).toBe(401)
        expect(await get(business)).toBe(403)
        expect(await get(platform)).toBe(401)
    })
})

describe("bots only notify: any message gets the way into the app", () => {
    let client: TestClient

    beforeEach(() => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
    })

    it("Zumda | Business answers a command with «Mening bizneslarim»", async () => {
        await client.businessBot({
            message: { from: ADMIN, chat: { id: ADMIN.id }, text: "/network" },
        })
        const reply = client.telegram.sent.at(-1)
        expect(reply?.chatId).toBe(ADMIN.id)
        expect(reply?.html).toContain("ilovada")
        expect(reply?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toBe(
            "https://business.zumda.test/?mode=business",
        )
    })

    it("Zumda | Business /start: the owner's instruction video above «Mening bizneslarim»", async () => {
        await client.businessBot({
            message: { from: OWNER, chat: { id: OWNER.id }, text: "/start" },
        })
        const welcome = client.telegram.videos.at(-1)
        expect(welcome?.video).toMatchObject({
            url: "https://zumda-app.pages.dev/welcome/biznes.mp4",
            coverUrl: "https://zumda-app.pages.dev/welcome/biznes-cover.jpg",
            durationS: 47,
        })
        expect(welcome?.html).toContain("Zumda Business")
        expect(welcome?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toBe(
            "https://business.zumda.test/?mode=business",
        )
        expect(client.telegram.pictures).toHaveLength(0)
    })

    it("Zumda | Kuryer: a stranger gets the welcome, no button to a screen they cannot use", async () => {
        await client.courierBot({
            message: { from: CUSTOMER, chat: { id: CUSTOMER.id }, text: "salom" },
        })
        const reply = client.telegram.sent.at(-1)
        expect(reply?.html).toContain("Zumda kuryer boti")
        expect(reply?.options?.keyboard).toBeUndefined()
    })

    it("an application card comes from Zumda | Platforma: the approve buttons and the app", async () => {
        const response = await client.as(OWNER, { businessBot: true })("/api/platform/shops", {
            method: "POST",
            json: {
                botToken: SHOP_BOT_TOKEN,
                name: "Osh Markaz",
                type: "food",
                deliveryFee: 0,
                payoutCard: TEST_CARD,
            },
        })
        const { id } = await json<{ id: string }>(response)
        const card = client.telegram.sent.find((m) => m.chatId === ADMIN.id)
        expect(card?.token).toBe(env.ADMIN_BOT_TOKEN)
        const rows = card?.options?.keyboard?.inline_keyboard ?? []
        expect(rows[0]?.map((b) => b.callback_data)).toEqual([`r:${id}:approve`, `r:${id}:reject`])
        expect(rows[1]?.[0]?.web_app?.url).toBe(
            `https://platform.zumda.test/?mode=admin&admin=shop_${id}`,
        )
        const toOwner = client.telegram.sent.find((m) => m.chatId === OWNER.id)
        expect(toOwner?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toContain(
            "mode=business",
        )
    })
})

describe("Zumda | Platforma: the admins' bot only notifies", () => {
    let client: TestClient

    beforeEach(() => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
    })

    async function apply(): Promise<string> {
        const response = await client.as(OWNER, { businessBot: true })("/api/platform/shops", {
            method: "POST",
            json: {
                botToken: SHOP_BOT_TOKEN,
                name: "Osh Markaz",
                type: "food",
                deliveryFee: 0,
                payoutCard: TEST_CARD,
            },
        })
        expect(response.status).toBe(201)
        return (await json<{ id: string }>(response)).id
    }

    async function statusOf(id: string): Promise<string | undefined> {
        const row = await env.DB.prepare("SELECT status FROM businesses WHERE id = ?")
            .bind(id)
            .first<{ status: string }>()
        return row?.status
    }

    const appUrl = (message: SentMessage | undefined): string | undefined =>
        message?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url

    it("answers only Telegram with its own secret", async () => {
        const forged = await client.request("/tg/admin", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Telegram-Bot-Api-Secret-Token": env.BUSINESS_WEBHOOK_SECRET,
            },
            body: JSON.stringify({
                message: { from: ADMIN, chat: { id: ADMIN.id }, text: "/start" },
            }),
        })
        expect(forged.status).toBe(401)
        expect(client.telegram.sent).toHaveLength(0)
    })

    it("an admin's /start opens «Platforma»; anything else is one line with the same button", async () => {
        await client.adminBot({ message: { from: ADMIN, chat: { id: ADMIN.id }, text: "/start" } })
        const welcome = client.telegram.sent.at(-1)
        expect(welcome?.token).toBe(env.ADMIN_BOT_TOKEN)
        expect(welcome?.html).toContain("Zumda | Platforma")
        expect(appUrl(welcome)).toBe("https://platform.zumda.test/?mode=admin")
        await client.adminBot({ message: { from: ADMIN, chat: { id: ADMIN.id }, text: "salom" } })
        const reply = client.telegram.sent.at(-1)
        expect(reply?.html).toContain("ilovada")
        expect(appUrl(reply)).toBe("https://platform.zumda.test/?mode=admin")
    })

    it("someone who is not an admin is shown Zumda's other bots, never «Platforma»", async () => {
        await client.adminBot({
            message: { from: STRANGER, chat: { id: STRANGER.id }, text: "/start" },
        })
        const reply = client.telegram.sent.at(-1)
        expect(reply?.chatId).toBe(STRANGER.id)
        expect(reply?.html).toContain("faqat Zumda jamoasi")
        const buttons = reply?.options?.keyboard?.inline_keyboard.flat() ?? []
        expect(buttons.map((b) => b.url)).toEqual([
            "https://t.me/zumdashop_bot",
            "https://t.me/zumda_biznes_bot",
        ])
        expect(buttons.some((b) => b.web_app !== undefined)).toBe(false)
    })

    it("«Tasdiqlash» on its card approves the application and marks the card", async () => {
        const id = await apply()
        await client.adminBot({
            callback_query: {
                id: "cb-1",
                from: ADMIN,
                data: `r:${id}:approve`,
                message: { message_id: 7, chat: { id: ADMIN.id } },
            },
        })
        expect(await statusOf(id)).toBe("active")
        expect(client.telegram.edited.at(-1)).toMatchObject({
            token: env.ADMIN_BOT_TOKEN,
            chatId: ADMIN.id,
            messageId: 7,
        })
    })

    it("an admin who never pressed Start there gets it from Zumda | Business, with the way there", async () => {
        client.telegram.notStarted.add(`${env.ADMIN_BOT_TOKEN}:${ADMIN.id}`)
        const id = await apply()
        const card = client.telegram.sent.find((m) => m.chatId === ADMIN.id)
        expect(card?.token).toBe(env.BUSINESS_BOT_TOKEN)
        expect(card?.html).toContain("@zumdashop_platforma_bot sizga yoza olmadi")
        expect(card?.html).toContain("Osh Markaz")
        const rows = card?.options?.keyboard?.inline_keyboard ?? []
        expect(rows[0]?.map((b) => b.callback_data)).toEqual([`r:${id}:approve`, `r:${id}:reject`])
        // An app button there would open «Platforma» signed by the wrong bot: the link instead.
        expect(rows.flat().some((b) => b.web_app !== undefined)).toBe(false)
        expect(rows.at(-1)?.[0]?.url).toBe("https://t.me/zumdashop_platforma_bot")
        // Its buttons still work from Zumda | Business.
        await client.businessBot({
            callback_query: { id: "cb-2", from: ADMIN, data: `r:${id}:approve` },
        })
        expect(await statusOf(id)).toBe("active")
    })
})

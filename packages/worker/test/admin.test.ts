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

import type { TestClient } from "./helpers.js"

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

describe("«Platforma»: the admins' section of Zumda | Business (/api/admin)", () => {
    let client: TestClient

    const admin = (): ReturnType<TestClient["as"]> => client.as(ADMIN, { businessBot: true })

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

    it("the app learns who is an admin", async () => {
        const me = async (user: object): Promise<unknown> =>
            json(await client.as(user, { businessBot: true })("/api/platform/me"))
        expect(await me(ADMIN)).toEqual({ admin: true })
        expect(await me(OWNER)).toEqual({ admin: false })
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

    it("only an admin, only from Zumda | Business: every other door is closed", async () => {
        const { id, slug } = await createActiveShop(client)
        const paths: [string, RequestInit & { json?: unknown }][] = [
            ["/api/admin/shops?status=active", {}],
            [`/api/admin/shops/${id}`, { method: "PATCH", json: { decision: "reject" } }],
            [`/api/admin/shops/${id}/reconnect`, { method: "POST" }],
            [`/api/admin/shops/${id}/marketplace`, { method: "PUT", json: { percent: 5 } }],
            ["/api/admin/districts", {}],
        ]
        const doors = [
            client.as(OWNER, { businessBot: true }),
            client.as(STRANGER, { businessBot: true }),
            // The admin, but opened from another bot or inside a shop.
            client.as(ADMIN, {}),
            client.as(ADMIN, { courierBot: true }),
            client.as(ADMIN, { businessBot: true, shop: slug }),
        ]
        for (const door of doors) {
            for (const [path, init] of paths) {
                const status = (await door(path, init)).status
                expect([401, 403], `${path} → ${status}`).toContain(status)
            }
        }
        // A shop bot's token can sign any user id: it never opens «Platforma».
        const forged = client.as(ADMIN, { botToken: SHOP_BOT_TOKEN, businessBot: true })
        expect((await forged("/api/admin/districts")).status).toBe(401)
        const old = client.as(ADMIN, {
            businessBot: true,
            authDate: new Date(Date.now() - 2 * DAY_MS),
        })
        expect((await old("/api/admin/districts")).status).toBe(401)
        const row = await env.DB.prepare("SELECT status FROM businesses WHERE id = ?")
            .bind(id)
            .first<{ status: string }>()
        expect(row?.status).toBe("active")
    })

    it("in a browser (business.zumda.shop) the admin's session opens it, nobody else's", async () => {
        const session = async (user: { id: number; first_name: string }): Promise<string> =>
            (
                await issueSession(
                    { id: user.id, firstName: user.first_name },
                    env.BUSINESS_SESSION_SECRET,
                    new Date(),
                )
            ).token
        const get = async (token: string): Promise<number> =>
            (
                await client.request("/api/admin/districts", {
                    headers: { Authorization: `Bearer ${token}` },
                })
            ).status
        expect(await get(await session(ADMIN))).toBe(200)
        expect(await get(await session(OWNER))).toBe(403)
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

    it("Zumda | Kuryer: a stranger gets the welcome, no button to a screen they cannot use", async () => {
        await client.courierBot({
            message: { from: CUSTOMER, chat: { id: CUSTOMER.id }, text: "salom" },
        })
        const reply = client.telegram.sent.at(-1)
        expect(reply?.html).toContain("Zumda kuryer boti")
        expect(reply?.options?.keyboard).toBeUndefined()
    })

    it("an application card has the approve buttons and the application in the app", async () => {
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
        const rows = card?.options?.keyboard?.inline_keyboard ?? []
        expect(rows[0]?.map((b) => b.callback_data)).toEqual([`r:${id}:approve`, `r:${id}:reject`])
        expect(rows[1]?.[0]?.web_app?.url).toBe(
            `https://business.zumda.test/?mode=business&admin=shop_${id}`,
        )
        const toOwner = client.telegram.sent.find((m) => m.chatId === OWNER.id)
        expect(toOwner?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toContain(
            "mode=business",
        )
    })
})

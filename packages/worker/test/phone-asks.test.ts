import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    ADMIN,
    CUSTOMER,
    OTHER_BOT_TOKEN,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    createActiveShop,
    hireCourier,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

interface Count {
    audience: string
    total: number
    left: number
}

const OTHER_BOT = { id: 888000, username: "baraka_bot", firstName: "Baraka" }
const COURIER = { id: 5005, first_name: "Jasur", language_code: "uz" }
const OWNER_PHONE = "+998905550001"
const DAY_MS = 24 * 60 * 60 * 1000

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

/**
 * «Raqam so'rash» (owner's decision, October 2026): an admin asks everyone a missing phone stops,
 * with one button in their role's bot, each at most once a day. The owner's own number, sent from
 * Zumda | Business, becomes the number of their shops that have none.
 */
describe("«Raqam so'rash»: one button in the role's bot, once a day", () => {
    let client: TestClient
    let now: number
    let food: { id: string; slug: string }
    // Signed at the test's own time: a day later the admin opens «Platforma» again.
    const admin = (): ReturnType<TestClient["as"]> =>
        client.as(ADMIN, { businessBot: true, authDate: new Date(now) })
    const counts = async (): Promise<Count[]> =>
        (await json<{ data: Count[] }>(await admin()("/api/admin/phone-asks"))).data
    const press = async (): Promise<unknown> =>
        json(await admin()("/api/admin/phone-asks/send", { method: "POST" }))
    const shop = async (): Promise<{ callPhone?: string; paymentMethods: string[] }> =>
        json(await client.as(CUSTOMER, { botToken: SHOP_BOT_TOKEN, shop: food.slug })("/api/shop"))

    beforeEach(async () => {
        now = Date.now()
        client = testClient({
            bots: { [SHOP_BOT_TOKEN]: SHOP_BOT, [OTHER_BOT_TOKEN]: OTHER_BOT },
            clock: { now: (): Date => new Date(now) },
        })
        // The same owner: one shop without a number, one with it.
        food = await createActiveShop(client, { name: "Osh markazi", phone: null })
        await createActiveShop(client, { botToken: OTHER_BOT_TOKEN, name: "Baraka" })
    })

    it("asks the owner from Zumda | Business and the courier from Zumda | Kuryer", async () => {
        await hireCourier(client, { slug: food.slug }, COURIER)
        await env.DB.prepare("UPDATE courier_profiles SET phone = NULL WHERE telegram_id = ?")
            .bind(COURIER.id)
            .run()
        expect(await counts()).toEqual([
            { audience: "owner", total: 1, left: 1 },
            { audience: "courier", total: 1, left: 1 },
        ])
        client.telegram.sent.length = 0

        expect(await press()).toEqual({ sent: 2, unreachable: 0, left: 0 })
        const toOwner = client.telegram.sent.find((m) => m.chatId === OWNER.id)
        expect(toOwner?.token).toBe(env.BUSINESS_BOT_TOKEN)
        // Only the shop a number is missing for, by name.
        expect(toOwner?.html).toContain("<b>Osh markazi</b> buyurtma qabul qilmayapti")
        expect(toOwner?.html).not.toContain("Baraka")
        expect(toOwner?.options).toMatchObject({
            askContact: "📱 Raqamimni yuborish",
            askContactOr: "✏️ Boshqa raqam yozaman",
        })
        const toCourier = client.telegram.sent.find((m) => m.chatId === COURIER.id)
        expect(toCourier?.token).toBe(env.COURIER_BOT_TOKEN)
        expect(toCourier?.html).toContain("Raqamsiz buyurtma kelmaydi")
        expect(toCourier?.options).toMatchObject({ askContact: "📱 Raqamni yuborish" })

        // Once a day: a second press the same day writes to nobody.
        expect(await press()).toEqual({ sent: 0, unreachable: 0, left: 0 })
        expect(await counts()).toEqual([
            { audience: "owner", total: 1, left: 0 },
            { audience: "courier", total: 1, left: 0 },
        ])
        // Still without a phone a day later: asked again.
        now += DAY_MS + 1
        expect(await press()).toEqual({ sent: 2, unreachable: 0, left: 0 })
    })

    it("the owner sends their number with one button: the shop shows it and takes orders", async () => {
        expect(await shop()).toMatchObject({ paymentMethods: [] })
        await client.businessBot({
            message: {
                from: OWNER,
                chat: { id: OWNER.id },
                contact: { phone_number: OWNER_PHONE, user_id: OWNER.id },
            },
        })
        const saved = client.telegram.sent.at(-1)
        expect(saved?.token).toBe(env.BUSINESS_BOT_TOKEN)
        expect(saved?.html).toContain("Raqamingiz saqlandi")
        expect(saved?.options).toMatchObject({ removeKeyboard: true })

        const storefront = await shop()
        expect(storefront.callPhone).toBe(OWNER_PHONE)
        expect(storefront.paymentMethods).not.toHaveLength(0)
        expect((await counts()).find((c) => c.audience === "owner")).toMatchObject({ total: 0 })
    })

    it("«Boshqa raqam yozaman» shows where to type the shop's number; a forwarded contact is ignored", async () => {
        await client.businessBot({
            message: { from: OWNER, chat: { id: OWNER.id }, text: "✏️ Boshqa raqam yozaman" },
        })
        const how = client.telegram.sent.at(-1)
        expect(how?.html).toContain("«Mijozlar uchun telefon»")
        expect(JSON.stringify(how?.options?.keyboard)).toContain("mode=business")

        const before = client.telegram.sent.length
        await client.businessBot({
            message: {
                from: OWNER,
                chat: { id: OWNER.id },
                contact: { phone_number: OWNER_PHONE, user_id: 777 },
            },
        })
        expect(client.telegram.sent).toHaveLength(before)
        expect(await shop()).not.toHaveProperty("callPhone")
    })

    it("a demo or turned-off shop is left out; an owner the bot cannot reach is counted", async () => {
        await env.DB.prepare("UPDATE businesses SET demo_at = 1 WHERE id = ?").bind(food.id).run()
        expect((await counts()).find((c) => c.audience === "owner")).toMatchObject({ total: 0 })
        await env.DB.prepare(
            "UPDATE businesses SET demo_at = NULL, status = 'disabled' WHERE id = ?",
        )
            .bind(food.id)
            .run()
        expect((await counts()).find((c) => c.audience === "owner")).toMatchObject({ total: 0 })
        await env.DB.prepare("UPDATE businesses SET status = 'active' WHERE id = ?")
            .bind(food.id)
            .run()

        client.telegram.notStarted.add(`${env.BUSINESS_BOT_TOKEN}:${OWNER.id}`)
        expect(await press()).toEqual({ sent: 0, unreachable: 1, left: 0 })
    })

    it("only a platform admin sees who has no phone and asks", async () => {
        const owner = client.as(OWNER, { businessBot: true })
        expect((await owner("/api/admin/phone-asks")).status).toBe(403)
        expect((await owner("/api/admin/phone-asks/send", { method: "POST" })).status).toBe(403)
        expect(client.telegram.sent.filter((m) => m.html.includes("qilmayapti"))).toHaveLength(0)
    })
})

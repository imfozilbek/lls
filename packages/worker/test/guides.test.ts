import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import {
    ADMIN,
    CUSTOMER,
    OTHER_BOT_TOKEN,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
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

async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T
}

/** A customer who came to these shops, the last one last. */
async function customerOf(telegramId: number, shops: string[]): Promise<void> {
    const id = `cust-${telegramId}`
    await env.DB.prepare(
        `INSERT INTO customers (id, telegram_id, name, language, created_at, updated_at)
         VALUES (?, ?, 'Malika', 'uz', 1, 1)`,
    )
        .bind(id, telegramId)
        .run()
    for (const [i, shop] of shops.entries()) {
        await env.DB.prepare(
            "INSERT INTO customer_businesses (customer_id, business_id, first_order_at) VALUES (?, ?, ?)",
        )
            .bind(id, shop, 1000 + i)
            .run()
    }
}

describe("«Qo'llanma»: everyone gets their role's guide once, from their role's bot", () => {
    let client: TestClient
    let food: { id: string; slug: string }
    let grocery: { id: string; slug: string }
    const admin = (): ReturnType<TestClient["as"]> => client.as(ADMIN, { businessBot: true })
    const counts = async (): Promise<Count[]> =>
        (await json<{ data: Count[] }>(await admin()("/api/admin/guides"))).data
    const send = async (audience: string): Promise<Response> =>
        admin()(`/api/admin/guides/${audience}/send`, { method: "POST" })

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT, [OTHER_BOT_TOKEN]: OTHER_BOT } })
        food = await createActiveShop(client)
        grocery = await createActiveShop(client, { botToken: OTHER_BOT_TOKEN, name: "Baraka" })
    })

    it("owners get the owner's video from Zumda | Business with «Mening bizneslarim»", async () => {
        expect((await counts()).find((c) => c.audience === "owner")).toEqual({
            audience: "owner",
            total: 1,
            left: 1,
        })
        const response = await send("owner")
        expect(await json(response)).toEqual({
            audience: "owner",
            sent: 1,
            unreachable: 0,
            left: 0,
        })
        const [guide] = client.telegram.videos
        expect(guide?.token).toBe(env.BUSINESS_BOT_TOKEN)
        expect(guide?.chatId).toBe(OWNER.id)
        expect(guide?.video.url).toMatch(/\/welcome\/biznes\.mp4$/)
        expect(guide?.html).toContain("biznes egasi uchun")
        expect(guide?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toContain(
            "mode=business",
        )
        // Once: the next press writes to nobody.
        expect(await json(await send("owner"))).toMatchObject({ sent: 0, left: 0 })
        expect(client.telegram.videos).toHaveLength(1)
    })

    it("couriers get the courier's video from Zumda | Kuryer", async () => {
        await hireCourier(client, { slug: food.slug }, STRANGER)
        expect(await json(await send("courier"))).toMatchObject({ sent: 1, left: 0 })
        const guide = client.telegram.videos.at(-1)
        expect(guide?.token).toBe(env.COURIER_BOT_TOKEN)
        expect(guide?.chatId).toBe(STRANGER.id)
        expect(guide?.video.url).toMatch(/\/welcome\/kuryer\.mp4$/)
        expect(guide?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toContain(
            "mode=courier",
        )
    })

    it("a customer gets Zumda | Shop's video from their last shop's bot, with the invitation", async () => {
        await env.DB.prepare(
            `UPDATE businesses SET marketplace_commission_bps = 500, marketplace_joined_at = 1
             WHERE id = ?`,
        )
            .bind(food.id)
            .run()
        await customerOf(CUSTOMER.id, [grocery.id, food.id])
        expect(await json(await send("customer"))).toMatchObject({ sent: 1, left: 0 })
        const guide = client.telegram.videos.at(-1)
        // From Osh Markaz's own bot (the last shop), never from Zumda's.
        expect(guide?.token).toBe(SHOP_BOT_TOKEN)
        expect(guide?.chatId).toBe(CUSTOMER.id)
        expect(guide?.video.url).toMatch(/\/welcome\/zumda\.mp4$/)
        expect(guide?.html).toContain("Osh Markaz")
        const [invite, menu] = guide?.options?.keyboard?.inline_keyboard ?? []
        // The shop is in the showcase: Zumda | Shop opens right on it.
        expect(invite?.[0]?.url).toBe(`https://t.me/zumdashop_bot?startapp=m_${food.slug}`)
        expect(menu?.[0]?.web_app?.url).toContain(`shop=${food.slug}`)
    })

    it("a shop off the showcase invites to Zumda | Shop itself; demo shops reach nobody", async () => {
        await customerOf(CUSTOMER.id, [grocery.id])
        await customerOf(STRANGER.id, [food.id])
        await env.DB.prepare("UPDATE businesses SET demo_at = 1 WHERE id = ?").bind(food.id).run()
        expect((await counts()).find((c) => c.audience === "customer")?.total).toBe(1)
        await send("customer")
        expect(client.telegram.videos).toHaveLength(1)
        const guide = client.telegram.videos[0]
        expect(guide?.token).toBe(OTHER_BOT_TOKEN)
        expect(guide?.options?.keyboard?.inline_keyboard[0]?.[0]?.url).toBe(
            "https://t.me/zumdashop_bot",
        )
    })

    it("someone who never opened the bot is counted once and not written to again", async () => {
        client.telegram.notStarted.add(`${env.BUSINESS_BOT_TOKEN}:${OWNER.id}`)
        expect(await json(await send("owner"))).toEqual({
            audience: "owner",
            sent: 0,
            unreachable: 1,
            left: 0,
        })
        client.telegram.notStarted.clear()
        expect(await json(await send("owner"))).toMatchObject({ sent: 0, unreachable: 0 })
        expect(client.telegram.videos).toHaveLength(0)
    })

    it("when Telegram cannot take the video, the guide goes as text", async () => {
        client.telegram.failVideos = true
        expect(await json(await send("owner"))).toMatchObject({ sent: 1 })
        expect(client.telegram.sent.at(-1)?.html).toContain("biznes egasi uchun")
    })

    it("only a platform admin sees «Qo'llanma» and sends", async () => {
        const owner = client.as(OWNER, { businessBot: true })
        expect((await owner("/api/admin/guides")).status).toBe(403)
        expect((await owner("/api/admin/guides/owner/send", { method: "POST" })).status).toBe(403)
        expect((await send("everyone")).status).toBe(400)
        expect(client.telegram.videos).toHaveLength(0)
    })
})

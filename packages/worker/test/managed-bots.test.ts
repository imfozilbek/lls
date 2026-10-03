import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import { suggestBotUsername } from "../src/telegram/managed-bots.js"

import {
    ADMIN,
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
    TEST_CARD,
    createActiveShop,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

/** The bot the owner creates in Telegram's window; Zumda manages it. secret-scan: fake */
const MANAGED_BOT = { id: 555000, username: "osh_markaz_bot" }
const MANAGED_TOKEN = "555000:managed-bot-token-for-tests-only-xxxxxx"
const NEW_MANAGED_TOKEN = "555000:managed-bot-token-replaced-in-tests-xxx"
const DAY_MS = 24 * 60 * 60 * 1000

/** The bots are created by, and report to, Zumda Business. */
function platformUpdate(client: TestClient, body: object): Promise<Response> {
    return client.businessBot(body)
}

/** Telegram tells Zumda Business that `user` created (or changed) the managed bot. */
async function managedBotUpdate(
    client: TestClient,
    user: object,
    token = MANAGED_TOKEN,
): Promise<Response> {
    client.telegram.managedTokens.set(MANAGED_BOT.id, token)
    return platformUpdate(client, { update_id: 1, managed_bot: { user, bot: MANAGED_BOT } })
}

const APPLICATION = {
    name: "Osh Markaz",
    type: "food",
    address: "Chorsu",
    deliveryFee: 10_000,
    payoutCard: TEST_CARD,
}

async function applyWithManagedBot(client: TestClient, user: object = OWNER): Promise<Response> {
    return client.as(user, { businessBot: true })("/api/platform/shops", {
        method: "POST",
        json: { ...APPLICATION, managedBotId: MANAGED_BOT.id },
    })
}

async function approve(client: TestClient, shopId: string): Promise<void> {
    await platformUpdate(client, {
        callback_query: {
            id: "cb-approve",
            from: ADMIN,
            data: `r:${shopId}:approve`,
            message: { message_id: 5, chat: { id: ADMIN.id } },
        },
    })
}

describe("suggested @username of a new shop bot", () => {
    it("is Latin, ends in _bot and fits Telegram's 32 characters", () => {
        expect(suggestBotUsername("Osh Markaz")).toBe("osh_markaz_bot")
        expect(suggestBotUsername("Qo'qon somsa")).toBe("qoqon_somsa_bot")
        expect(suggestBotUsername("Тандир Ҳовли")).toBe("tandir_hovli_bot")
        expect(suggestBotUsername("24/7 Suv")).toBe("suv_bot")
        expect(suggestBotUsername("Burger Bot")).toBe("burger_bot")
        expect(suggestBotUsername("☕️")).toBe("dokon_bot")
        const long = suggestBotUsername("Maqsudbek burger va qahva uyi markaziy filiali")
        expect(long.length).toBeLessThanOrEqual(32)
        expect(long).toMatch(/^[a-z][a-z0-9_]{3,}_bot$/)
    })
})

describe("a bot created from Zumda Business (Managed Bots)", () => {
    let client: TestClient

    beforeEach(() => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
    })

    it("prepare gives the button for requestChat and the t.me/newbot link", async () => {
        const response = await client.as(OWNER, { businessBot: true })(
            "/api/platform/managed-bot/prepare",
            {
                method: "POST",
                json: { name: "Osh Markaz" },
            },
        )
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            preparedId: "prepared-1",
            link: "https://t.me/newbot/zumda_biznes_bot/osh_markaz_bot?name=Osh+Markaz",
        })
        const [prepared] = client.telegram.preparedButtons
        expect(prepared?.token).toBe(env.BUSINESS_BOT_TOKEN)
        expect(prepared?.userId).toBe(OWNER.id)
        expect(prepared?.button).toMatchObject({
            text: "🤖 Bot yaratish",
            suggestedName: "Osh Markaz",
            suggestedUsername: "osh_markaz_bot",
        })
        expect(prepared?.button.requestId).toBeGreaterThan(0)
    })

    it("prepare is for Zumda Business only, and validates the name", async () => {
        const shop = await createActiveShop(client)
        const fromShopBot = await client.as(OWNER, { botToken: SHOP_BOT_TOKEN, shop: shop.slug })(
            "/api/platform/managed-bot/prepare",
            { method: "POST", json: { name: "Osh" } },
        )
        expect(fromShopBot.status).toBe(400)
        // The customers' Zumda bot cannot create bots or apply.
        const fromShowcaseBot = await client.as(OWNER, {})("/api/platform/managed-bot/prepare", {
            method: "POST",
            json: { name: "Osh" },
        })
        expect(fromShowcaseBot.status).toBe(403)
        expect((await client.as(OWNER, {})("/api/platform/shops")).status).toBe(403)
        const empty = await client.as(OWNER, { businessBot: true })(
            "/api/platform/managed-bot/prepare",
            {
                method: "POST",
                json: { name: " " },
            },
        )
        expect(empty.status).toBe(400)
    })

    it("managed_bot: the token is stored encrypted and the owner is invited back", async () => {
        expect((await managedBotUpdate(client, OWNER)).status).toBe(200)
        const row = await env.DB.prepare(
            "SELECT owner_telegram_id, token_enc, business_id FROM managed_bots WHERE bot_id = ?",
        )
            .bind(MANAGED_BOT.id)
            .first<{ owner_telegram_id: number; token_enc: string; business_id: string | null }>()
        expect(row?.owner_telegram_id).toBe(OWNER.id)
        expect(row?.business_id).toBeNull()
        expect(row?.token_enc).not.toContain(MANAGED_TOKEN)
        const message = client.telegram.sent.at(-1)
        expect(message?.chatId).toBe(OWNER.id)
        expect(message?.token).toBe(env.BUSINESS_BOT_TOKEN)
        expect(message?.html).toContain("@osh_markaz_bot yaratildi")
        expect(message?.html).not.toContain(MANAGED_TOKEN)
        expect(message?.options?.keyboard?.inline_keyboard[0]?.[0]?.web_app?.url).toBe(
            "https://business.zumda.test/?mode=business",
        )

        const mine = await client.as(OWNER, { businessBot: true })("/api/platform/managed-bots")
        expect(await mine.json()).toEqual({
            data: [{ botId: MANAGED_BOT.id, username: MANAGED_BOT.username }],
        })
        const theirs = await client.as(STRANGER, { businessBot: true })(
            "/api/platform/managed-bots",
        )
        expect(await theirs.json()).toEqual({ data: [] })
    })

    it("a managed_bot whose token Telegram does not give is answered 200 and not stored", async () => {
        const response = await platformUpdate(client, {
            managed_bot: { user: OWNER, bot: { id: 1, username: "ghost_bot" } },
        })
        expect(response.status).toBe(200)
        const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM managed_bots").first<{
            n: number
        }>()
        expect(count?.n).toBe(0)
    })

    it("the application takes the managed bot: no token from the owner; approval connects it", async () => {
        await managedBotUpdate(client, OWNER)
        const response = await applyWithManagedBot(client)
        expect(response.status).toBe(201)
        const shop = (await response.json()) as {
            id: string
            botUsername: string
            managedBot: boolean
        }
        expect(shop.botUsername).toBe(MANAGED_BOT.username)
        expect(shop.managedBot).toBe(true)
        // Taken: the list of waiting bots is empty, and a second application cannot reuse it.
        const mine = await client.as(OWNER, { businessBot: true })("/api/platform/managed-bots")
        expect(await mine.json()).toEqual({ data: [] })
        expect((await applyWithManagedBot(client)).status).toBe(404)

        await approve(client, shop.id)
        expect(client.telegram.webhooks.at(-1)).toMatchObject({
            token: MANAGED_TOKEN,
            url: `http://localhost/tg/${MANAGED_BOT.id}`,
        })
        expect(client.telegram.menuButtons.at(-1)?.token).toBe(MANAGED_TOKEN)
    })

    it("someone else's managed bot, or an unknown one, cannot be taken", async () => {
        await managedBotUpdate(client, OWNER)
        expect((await applyWithManagedBot(client, STRANGER)).status).toBe(404)
        const unknown = await client.as(OWNER, { businessBot: true })("/api/platform/shops", {
            method: "POST",
            json: { ...APPLICATION, managedBotId: 42 },
        })
        expect(unknown.status).toBe(404)
    })

    it("the application sends a token or a managed bot, exactly one", async () => {
        await managedBotUpdate(client, OWNER)
        const both = await client.as(OWNER, { businessBot: true })("/api/platform/shops", {
            method: "POST",
            json: { ...APPLICATION, managedBotId: MANAGED_BOT.id, botToken: SHOP_BOT_TOKEN },
        })
        expect(both.status).toBe(400)
        const none = await client.as(OWNER, { businessBot: true })("/api/platform/shops", {
            method: "POST",
            json: APPLICATION,
        })
        expect(none.status).toBe(400)
    })

    it("a new token of a live shop's bot is picked up and the bot connected again", async () => {
        await managedBotUpdate(client, OWNER)
        const shop = (await (await applyWithManagedBot(client)).json()) as { id: string }
        await approve(client, shop.id)
        const before = client.telegram.webhooks.length

        await managedBotUpdate(client, OWNER, NEW_MANAGED_TOKEN)
        expect(client.telegram.webhooks).toHaveLength(before + 1)
        expect(client.telegram.webhooks.at(-1)?.token).toBe(NEW_MANAGED_TOKEN)
        expect(client.telegram.menuButtons.at(-1)?.token).toBe(NEW_MANAGED_TOKEN)
        // Nobody is told: nothing changed for people, and admins are not bothered.
        expect(
            client.telegram.sent.filter((m) => m.chatId === ADMIN.id).at(-1)?.html,
        ).not.toContain("egasi o'zgardi")
    })

    it("a new owner of the shop's bot alerts the admins; the shop stays with its owner", async () => {
        await managedBotUpdate(client, OWNER)
        const shop = (await (await applyWithManagedBot(client)).json()) as { id: string }
        await approve(client, shop.id)

        await managedBotUpdate(client, STRANGER, NEW_MANAGED_TOKEN)
        const alert = client.telegram.sent.at(-1)
        expect(alert?.chatId).toBe(ADMIN.id)
        expect(alert?.html).toContain("egasi o'zgardi")
        expect(alert?.html).toContain(`tg://user?id=${STRANGER.id}`)
        const owner = await env.DB.prepare("SELECT owner_telegram_id FROM businesses WHERE id = ?")
            .bind(shop.id)
            .first<{ owner_telegram_id: number }>()
        expect(owner?.owner_telegram_id).toBe(OWNER.id)
        // The bot keeps answering customers meanwhile, on its new token.
        expect(client.telegram.webhooks.at(-1)?.token).toBe(NEW_MANAGED_TOKEN)
    })

    it("a pending shop's new token waits for approval: no webhook yet", async () => {
        await managedBotUpdate(client, OWNER)
        await applyWithManagedBot(client)
        await managedBotUpdate(client, OWNER, NEW_MANAGED_TOKEN)
        expect(client.telegram.webhooks).toHaveLength(0)
    })

    it("a token changed in BotFather without an event is fetched fresh for the application", async () => {
        await managedBotUpdate(client, OWNER)
        // The owner changes the token in @BotFather; Telegram tells us nothing.
        client.telegram.managedTokens.set(MANAGED_BOT.id, NEW_MANAGED_TOKEN)
        const shop = (await (await applyWithManagedBot(client)).json()) as { id: string }
        await approve(client, shop.id)
        expect(client.telegram.webhooks.at(-1)?.token).toBe(NEW_MANAGED_TOKEN)
    })

    it("approval and «Botni qayta ulash» ask Telegram for the current token every time", async () => {
        await managedBotUpdate(client, OWNER)
        const shop = (await (await applyWithManagedBot(client)).json()) as {
            id: string
            slug: string
        }
        client.telegram.managedTokens.set(MANAGED_BOT.id, NEW_MANAGED_TOKEN)
        await approve(client, shop.id)
        expect(client.telegram.webhooks.at(-1)?.token).toBe(NEW_MANAGED_TOKEN)

        const third = "555000:managed-bot-token-third-in-tests-xxxxx" // secret-scan: fake
        client.telegram.managedTokens.set(MANAGED_BOT.id, third)
        const reconnected = await client.as(ADMIN, { businessBot: true })(
            `/api/admin/shops/${shop.id}/reconnect`,
            { method: "POST" },
        )
        expect(reconnected.status).toBe(200)
        expect(client.telegram.webhooks.at(-1)?.token).toBe(third)
    })

    it("Telegram refusing the token at approval warns the admin; the shop is not lost", async () => {
        await managedBotUpdate(client, OWNER)
        const shop = (await (await applyWithManagedBot(client)).json()) as { id: string }
        // Management turned off, for example: Telegram no longer gives the token.
        client.telegram.managedTokens.delete(MANAGED_BOT.id)
        await approve(client, shop.id)
        expect(client.telegram.webhooks).toHaveLength(0)
        expect(client.telegram.sent.at(-1)?.chatId).toBe(ADMIN.id)
        expect(client.telegram.sent.at(-1)?.html).toContain("Botni qayta ulash")
    })

    it("the pasted-token path still works", async () => {
        const shop = await createActiveShop(client)
        const row = await env.DB.prepare("SELECT bot_source FROM businesses WHERE id = ?")
            .bind(shop.id)
            .first<{ bot_source: string }>()
        expect(row?.bot_source).toBe("token")
    })
})

describe("«Mening bizneslarim»: the owner's shop from Zumda Business (X-Bot: business)", () => {
    let client: TestClient
    let slug: string

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
    })

    it("the owner gets the owner section, signed by Zumda Business", async () => {
        const response = await client.as(OWNER, { shop: slug, businessBot: true })(
            "/api/owner/shop",
        )
        expect(response.status).toBe(200)
        expect(((await response.json()) as { slug: string }).slug).toBe(slug)
    })

    it("anyone else gets 403, not the customer view", async () => {
        const response = await client.as(STRANGER, { shop: slug, businessBot: true })("/api/shop")
        expect(response.status).toBe(403)
    })

    it("the shop bot's signature does not open it (header spoofing)", async () => {
        const response = await client.as(OWNER, {
            botToken: SHOP_BOT_TOKEN,
            shop: slug,
            businessBot: true,
        })("/api/owner/shop")
        expect(response.status).toBe(401)
    })

    it("old initData is refused", async () => {
        const response = await client.as(OWNER, {
            shop: slug,
            businessBot: true,
            authDate: new Date(Date.now() - 2 * DAY_MS),
        })("/api/owner/shop")
        expect(response.status).toBe(401)
    })

    it("the showcase stays a customer view, even for the owner", async () => {
        await env.DB.prepare(
            "UPDATE businesses SET marketplace_commission_bps = 500, marketplace_joined_at = 1",
        ).run()
        const response = await client.as(OWNER, { shop: slug, via: "marketplace" })(
            "/api/owner/shop",
        )
        expect(response.status).toBe(403)
    })

    it("an unknown shop is 404", async () => {
        const response = await client.as(OWNER, { shop: "nope", businessBot: true })(
            "/api/owner/shop",
        )
        expect(response.status).toBe(404)
    })

    it("a pending shop opens to its owner too", async () => {
        await env.DB.prepare("UPDATE businesses SET status = 'pending'").run()
        const response = await client.as(OWNER, { shop: slug, businessBot: true })(
            "/api/owner/shop",
        )
        expect(response.status).toBe(200)
    })
})

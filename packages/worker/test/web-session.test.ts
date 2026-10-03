import { createHmac, createHash } from "node:crypto"

import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import { SESSION_DAYS, issueSession } from "../src/web-session.js"

import {
    OWNER,
    SHOP_BOT,
    SHOP_BOT_TOKEN,
    STRANGER,
    createActiveShop,
    testClient,
} from "./helpers.js"

import type { TestClient } from "./helpers.js"

const DAY_S = 24 * 60 * 60

/** What the Telegram Login Widget hands the page, signed like Telegram does. */
function widgetLogin(
    user: { id: number; first_name: string },
    botToken = env.BUSINESS_BOT_TOKEN,
    authDate = Math.floor(Date.now() / 1000),
): Record<string, string | number> {
    const fields: Record<string, string | number> = {
        id: user.id,
        first_name: user.first_name,
        username: "rustam_osh",
        auth_date: authDate,
    }
    const dataCheckString = Object.entries(fields)
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join("\n")
    const secret = createHash("sha256").update(botToken).digest()
    return { ...fields, hash: createHmac("sha256", secret).update(dataCheckString).digest("hex") }
}

describe("Zumda | Business in a browser (business.zumda.shop)", () => {
    let client: TestClient
    let slug: string

    async function signIn(login: object): Promise<Response> {
        return client.request("/api/business/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(login),
        })
    }

    async function asSession(token: string, path: string, shop?: string): Promise<Response> {
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
        if (shop) {
            headers["X-Shop"] = shop
        }
        return client.request(path, { headers })
    }

    async function sessionOf(user: { id: number; first_name: string }): Promise<string> {
        const response = await signIn(widgetLogin(user))
        expect(response.status).toBe(200)
        return ((await response.json()) as { token: string }).token
    }

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        slug = (await createActiveShop(client)).slug
    })

    it("the widget's login gives a session for «Mening bizneslarim» and the owner's shop", async () => {
        const response = await signIn(widgetLogin(OWNER))
        expect(response.status).toBe(200)
        const body = (await response.json()) as { token: string; expiresAt: string }
        expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * DAY_S * 1000)

        const mine = await asSession(body.token, "/api/platform/shops")
        expect(mine.status).toBe(200)
        expect(((await mine.json()) as { slug: string }[]).map((s) => s.slug)).toEqual([slug])
        expect((await asSession(body.token, "/api/owner/shop", slug)).status).toBe(200)
    })

    it("someone else's shop is 403, even with a valid session", async () => {
        const token = await sessionOf(STRANGER)
        expect((await asSession(token, "/api/owner/shop", slug)).status).toBe(403)
    })

    it("a login signed by another bot, changed, or old is refused", async () => {
        expect((await signIn(widgetLogin(OWNER, SHOP_BOT_TOKEN))).status).toBe(401)
        const forged = { ...widgetLogin(OWNER), id: STRANGER.id }
        expect((await signIn(forged)).status).toBe(401)
        const old = widgetLogin(
            OWNER,
            env.BUSINESS_BOT_TOKEN,
            Math.floor(Date.now() / 1000) - 2 * DAY_S,
        )
        expect((await signIn(old)).status).toBe(401)
        expect((await signIn({ id: OWNER.id })).status).toBe(400)
    })

    it("a forged or broken session is refused", async () => {
        const token = await sessionOf(OWNER)
        const [payload] = token.split(".")
        const forged = `${payload ?? ""}.${"0".repeat(64)}`
        expect((await asSession(forged, "/api/platform/shops")).status).toBe(401)
        expect((await asSession("nonsense", "/api/platform/shops")).status).toBe(401)
    })

    it("an expired session is refused", async () => {
        const longAgo = new Date(Date.now() - (SESSION_DAYS + 1) * DAY_S * 1000)
        const { token } = await issueSession(
            { id: OWNER.id, firstName: OWNER.first_name },
            env.BUSINESS_SESSION_SECRET,
            longAgo,
        )
        expect((await asSession(token, "/api/platform/shops")).status).toBe(401)
    })

    it("the browser may call the API from business.zumda.shop only", async () => {
        const preflight = await client.request("/api/platform/shops", {
            method: "OPTIONS",
            headers: {
                Origin: "https://business.zumda.test",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
        })
        expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(
            "https://business.zumda.test",
        )
        expect(preflight.headers.get("Access-Control-Allow-Headers")).toContain("Authorization")
    })
})

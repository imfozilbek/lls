import { env } from "cloudflare:workers"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { clientIdOf, issueLoginNonce } from "../src/telegram-login.js"
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
const ISSUER = "https://oauth.telegram.org"
const encoder = new TextEncoder()

function base64Url(bytes: Uint8Array): string {
    let binary = ""
    for (const byte of bytes) {
        binary += String.fromCharCode(byte)
    }
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

const json64 = (value: object): string => base64Url(encoder.encode(JSON.stringify(value)))

interface Signer {
    publicJwk: JsonWebKey
    sign(claims: Record<string, unknown>, kid?: string): Promise<string>
}

/** A key like Telegram's: RS256, published in a JWK set under `kid`. */
async function makeSigner(kid: string): Promise<Signer> {
    const pair = (await crypto.subtle.generateKey(
        {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["sign", "verify"],
    )) as CryptoKeyPair
    const exported = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey
    return {
        publicJwk: { ...exported, alg: "RS256", kid } as JsonWebKey,
        async sign(claims, headerKid = kid): Promise<string> {
            const head = json64({ alg: "RS256", typ: "JWT", kid: headerKid })
            const body = json64(claims)
            const signature = await crypto.subtle.sign(
                "RSASSA-PKCS1-v1_5",
                pair.privateKey,
                encoder.encode(`${head}.${body}`),
            )
            return `${head}.${body}.${base64Url(new Uint8Array(signature))}`
        },
    }
}

describe("Zumda | Business in a browser: Telegram Login (business.zumda.shop)", () => {
    let telegram: Signer
    let stranger: Signer
    let client: TestClient
    let slug: string

    /** What Telegram puts in the `id_token` for `user` after the owner confirms. */
    async function claims(
        user: { id: number; first_name: string },
        overrides: Record<string, unknown> = {},
    ): Promise<Record<string, unknown>> {
        const now = Math.floor(Date.now() / 1000)
        return {
            iss: ISSUER,
            aud: String(clientIdOf(env.BUSINESS_BOT_TOKEN)),
            sub: "pairwise-subject",
            iat: now,
            exp: now + 3600,
            id: user.id,
            name: user.first_name,
            given_name: user.first_name,
            preferred_username: "rustam_osh",
            nonce: await issueLoginNonce(env.BUSINESS_SESSION_SECRET, new Date()),
            ...overrides,
        }
    }

    async function signIn(idToken: string): Promise<Response> {
        return client.request("/api/business/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
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
        const response = await signIn(await telegram.sign(await claims(user)))
        expect(response.status).toBe(200)
        return ((await response.json()) as { token: string }).token
    }

    beforeAll(async () => {
        telegram = await makeSigner("oidc-1")
        stranger = await makeSigner("oidc-1")
    })

    beforeEach(async () => {
        client = testClient({
            bots: { [SHOP_BOT_TOKEN]: SHOP_BOT },
            loginKeys: () => Promise.resolve([telegram.publicJwk]),
        })
        slug = (await createActiveShop(client)).slug
    })

    it("the page gets the bot's Client ID and a nonce for Telegram's window", async () => {
        const response = await client.request("/api/business/login")
        const body = (await response.json()) as { clientId: number; nonce: string }
        expect(body.clientId).toBe(clientIdOf(env.BUSINESS_BOT_TOKEN))
        expect(body.nonce).toMatch(/^\d+\.[0-9a-f]{64}$/)
    })

    it("Telegram's id_token gives a session for «Mening bizneslarim» and the owner's shop", async () => {
        const response = await signIn(await telegram.sign(await claims(OWNER)))
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

    it("a token not signed by Telegram, for another bot, old, or replayed is refused", async () => {
        const refused = async (idToken: string): Promise<void> => {
            expect((await signIn(idToken)).status).toBe(401)
        }
        await refused(await stranger.sign(await claims(OWNER)))
        await refused(await telegram.sign(await claims(OWNER), "unknown-kid"))
        await refused(await telegram.sign(await claims(OWNER, { aud: "123456" })))
        await refused(await telegram.sign(await claims(OWNER, { iss: "https://evil.example" })))
        const past = Math.floor(Date.now() / 1000) - 2 * 3600
        await refused(await telegram.sign(await claims(OWNER, { exp: past })))
        await refused(await telegram.sign(await claims(OWNER, { nonce: "1.deadbeef" })))
        const stale = await issueLoginNonce(
            env.BUSINESS_SESSION_SECRET,
            new Date(Date.now() - DAY_S * 1000),
        )
        await refused(await telegram.sign(await claims(OWNER, { nonce: stale })))
        // A signed token whose claims were changed afterwards.
        const [head, , signature] = (await telegram.sign(await claims(OWNER))).split(".")
        const forged = json64(await claims(STRANGER))
        await refused(`${head ?? ""}.${forged}.${signature ?? ""}`)
        const body = { idToken: "not-a-token" }
        const invalid = await client.request("/api/business/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
        expect(invalid.status).toBe(400)
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

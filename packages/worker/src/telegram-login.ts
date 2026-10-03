/**
 * Telegram Login (OpenID Connect): how Zumda | Business signs an owner in on business.zumda.shop.
 * The page opens Telegram's window (`telegram-login.js`) and gets an `id_token`: a JWT Telegram
 * signs with its own key (RS256 by default). The Worker checks it against Telegram's published
 * keys, its issuer, our bot as the audience, its age, and a nonce only this Worker could have made.
 * https://core.telegram.org/bots/telegram-login
 */
import { timingSafeEqual } from "./crypto.js"

import type { TelegramUser } from "@zumda/core"

export const TELEGRAM_OAUTH_BASE = "https://oauth.telegram.org"
const ISSUER = "https://oauth.telegram.org"
const JWKS_PATH = "/.well-known/jwks.json"
/** Hosts a local stand may point the login at; anything else falls back to Telegram. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"])
/** Telegram rotates its keys rarely: one fetch an hour per Worker instance is plenty. */
const KEYS_TTL_MS = 60 * 60 * 1000
/** The time between opening the page and confirming in Telegram's window. */
const NONCE_TTL_MS = 10 * 60 * 1000
const CLOCK_SKEW_SECONDS = 60

const encoder = new TextEncoder()

/** Telegram's public keys (a JWK set), however they are fetched. */
export type LoginKeys = () => Promise<JsonWebKey[]>

/** The login address. A local stand points it at its fake Telegram on localhost, nothing else. */
export function telegramOauthBase(configured: string | undefined): string {
    if (!configured) {
        return TELEGRAM_OAUTH_BASE
    }
    try {
        const url = new URL(configured)
        const local = url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname)
        return local ? url.origin : TELEGRAM_OAUTH_BASE
    } catch {
        return TELEGRAM_OAUTH_BASE
    }
}

let cached: { base: string; keys: JsonWebKey[]; at: number } | null = null

/** Telegram's JWKS, kept for an hour in this Worker instance. */
export function publishedKeys(base: string): LoginKeys {
    return async (): Promise<JsonWebKey[]> => {
        const now = Date.now()
        if (cached && cached.base === base && now - cached.at < KEYS_TTL_MS) {
            return cached.keys
        }
        const response = await fetch(`${base}${JWKS_PATH}`)
        if (!response.ok) {
            throw new Error(`Telegram login keys: HTTP ${response.status}`)
        }
        const { keys } = (await response.json()) as { keys?: JsonWebKey[] }
        cached = { base, keys: keys ?? [], at: now }
        return cached.keys
    }
}

/** The bot's numeric id: the Client ID Telegram Login knows it by. */
export function clientIdOf(botToken: string): number {
    return Number(botToken.split(":")[0])
}

function toHex(buffer: ArrayBuffer): string {
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function hmacHex(secret: string, data: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    )
    return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(`login-nonce:${data}`)))
}

/** `issuedAt.signature`: goes into Telegram's window and comes back inside the `id_token`. */
export async function issueLoginNonce(secret: string, now: Date): Promise<string> {
    const issuedAt = String(now.getTime())
    return `${issuedAt}.${await hmacHex(secret, issuedAt)}`
}

async function nonceIsOurs(nonce: unknown, secret: string, now: Date): Promise<boolean> {
    if (typeof nonce !== "string") {
        return false
    }
    const [issuedAt, signature, extra] = nonce.split(".")
    if (!issuedAt || !signature || extra !== undefined) {
        return false
    }
    const age = now.getTime() - Number(issuedAt)
    if (!Number.isFinite(age) || age < -CLOCK_SKEW_SECONDS * 1000 || age > NONCE_TTL_MS) {
        return false
    }
    return timingSafeEqual(await hmacHex(secret, issuedAt), signature)
}

function fromBase64Url(value: string): Uint8Array {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/")
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

function decodeJson(part: string): Record<string, unknown> | null {
    try {
        const value: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(part)))
        return value !== null && typeof value === "object"
            ? (value as Record<string, unknown>)
            : null
    } catch {
        return null
    }
}

/** The algorithms Telegram signs with that WebCrypto in a Worker verifies. */
const ALGORITHMS: Record<
    string,
    { key: SubtleCryptoImportKeyAlgorithm; verify: SubtleCryptoSignAlgorithm }
> = {
    RS256: {
        key: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        verify: { name: "RSASSA-PKCS1-v1_5" },
    },
    ES256: {
        key: { name: "ECDSA", namedCurve: "P-256" },
        verify: { name: "ECDSA", hash: "SHA-256" },
    },
}

async function signatureIsValid(
    token: string,
    header: Record<string, unknown>,
    keys: JsonWebKey[],
): Promise<boolean> {
    const algorithm = typeof header["alg"] === "string" ? ALGORITHMS[header["alg"]] : undefined
    const jwk = keys.find((key) => (key as { kid?: string }).kid === header["kid"])
    if (!algorithm || !jwk || jwk.alg !== header["alg"]) {
        return false
    }
    const [head = "", body = "", signature = ""] = token.split(".")
    try {
        const key = await crypto.subtle.importKey("jwk", jwk, algorithm.key, false, ["verify"])
        return await crypto.subtle.verify(
            algorithm.verify,
            key,
            fromBase64Url(signature),
            encoder.encode(`${head}.${body}`),
        )
    } catch {
        return false
    }
}

function audienceIs(aud: unknown, clientId: number): boolean {
    const wanted = String(clientId)
    return Array.isArray(aud) ? aud.map(String).includes(wanted) : String(aud) === wanted
}

function timesAreValid(claims: Record<string, unknown>, now: Date): boolean {
    const seconds = now.getTime() / 1000
    const exp = Number(claims["exp"])
    const iat = Number(claims["iat"])
    return (
        Number.isFinite(exp) &&
        exp > seconds - CLOCK_SKEW_SECONDS &&
        (!Number.isFinite(iat) || iat <= seconds + CLOCK_SKEW_SECONDS)
    )
}

function userOf(claims: Record<string, unknown>): TelegramUser | null {
    const id = Number(claims["id"])
    if (!Number.isSafeInteger(id) || id <= 0) {
        return null
    }
    const text = (key: string): string | undefined =>
        typeof claims[key] === "string" ? (claims[key] as string) : undefined
    return {
        id,
        firstName: text("given_name") ?? text("name") ?? "",
        lastName: text("family_name"),
        username: text("preferred_username"),
    }
}

/**
 * The person in a Telegram Login `id_token`, or null if anything is off: the signature (a key
 * from Telegram's set), the issuer, our bot as the audience, the times, our own fresh nonce.
 */
export async function verifyLoginToken(
    token: string,
    check: { clientId: number; keys: LoginKeys; nonceSecret: string; now: Date },
): Promise<TelegramUser | null> {
    const [head, body, signature, extra] = token.split(".")
    if (!head || !body || !signature || extra !== undefined) {
        return null
    }
    const header = decodeJson(head)
    const claims = decodeJson(body)
    if (!header || !claims) {
        return null
    }
    if (!(await signatureIsValid(token, header, await check.keys()))) {
        return null
    }
    if (
        claims["iss"] !== ISSUER ||
        !audienceIs(claims["aud"], check.clientId) ||
        !timesAreValid(claims, check.now) ||
        !(await nonceIsOurs(claims["nonce"], check.nonceSecret, check.now))
    ) {
        return null
    }
    return userOf(claims)
}

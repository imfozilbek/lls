/**
 * Zumda | Business outside Telegram (business.zumda.shop in a browser): after Telegram Login
 * (`telegram-login.ts`) the owner gets a session token. The token goes in
 * `Authorization: Bearer`; no cookies, so no CSRF.
 */
import { timingSafeEqual } from "./crypto.js"

import type { TelegramUser } from "@zumda/core"

const encoder = new TextEncoder()

/** How long one sign-in lasts on a computer. */
export const SESSION_DAYS = 30
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000

function toHex(buffer: ArrayBuffer): string {
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function hmacHex(key: ArrayBuffer | Uint8Array, data: string): Promise<string> {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    )
    return toHex(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data)))
}

function base64Url(text: string): string {
    const bytes = encoder.encode(text)
    let binary = ""
    for (const byte of bytes) {
        binary += String.fromCharCode(byte)
    }
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

function fromBase64Url(value: string): string {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/")
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
}

interface SessionPayload {
    user: TelegramUser
    /** Unix ms. */
    exp: number
}

/** `payload.signature`: the person and the expiry, signed with the session secret. */
export async function issueSession(
    user: TelegramUser,
    secret: string,
    now: Date,
): Promise<{ token: string; expiresAt: string }> {
    const exp = now.getTime() + SESSION_MS
    const payload = base64Url(JSON.stringify({ user, exp } satisfies SessionPayload))
    const signature = await hmacHex(encoder.encode(secret), payload)
    return { token: `${payload}.${signature}`, expiresAt: new Date(exp).toISOString() }
}

/** The person of a valid, unexpired session token; null for anything else. */
export async function readSession(
    token: string,
    secret: string,
    now: Date,
): Promise<TelegramUser | null> {
    const [payload, signature, extra] = token.split(".")
    if (!payload || !signature || extra !== undefined) {
        return null
    }
    if (!timingSafeEqual(await hmacHex(encoder.encode(secret), payload), signature)) {
        return null
    }
    try {
        const session = JSON.parse(fromBase64Url(payload)) as Partial<SessionPayload>
        const user = session.user
        if (
            typeof session.exp !== "number" ||
            session.exp <= now.getTime() ||
            typeof user?.id !== "number"
        ) {
            return null
        }
        return user
    } catch {
        return null
    }
}

/** The token from `Authorization: Bearer <token>`, if any. */
export function bearerOf(header: string | undefined): string | null {
    const match = /^Bearer\s+(\S+)$/.exec(header ?? "")
    return match?.[1] ?? null
}

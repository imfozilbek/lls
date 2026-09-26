import type { TelegramUser } from "@lls/core"

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60
const CLOCK_SKEW_SECONDS = 60
const AES_IV_BYTES = 12

function toHex(buffer: ArrayBuffer): string {
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

function toBase64(bytes: Uint8Array): string {
    let binary = ""
    for (const byte of bytes) {
        binary += String.fromCharCode(byte)
    }
    return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    )
    return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data))
}

/** Compares two strings without leaking where they differ. */
export function timingSafeEqual(a: string, b: string): boolean {
    const left = encoder.encode(a)
    const right = encoder.encode(b)
    let diff = left.length ^ right.length
    for (let i = 0; i < left.length; i++) {
        diff |= (left[i] ?? 0) ^ (right[i % right.length] ?? 0)
    }
    return diff === 0
}

export interface VerifiedInitData {
    user: TelegramUser
    authDate: Date
    startParam?: string
}

interface RawInitUser {
    id?: unknown
    first_name?: unknown
    last_name?: unknown
    username?: unknown
    language_code?: unknown
}

function parseUser(raw: string | null): TelegramUser | null {
    if (!raw) {
        return null
    }
    const user = JSON.parse(raw) as RawInitUser
    if (typeof user.id !== "number" || !Number.isSafeInteger(user.id)) {
        return null
    }
    const text = (value: unknown): string | undefined =>
        typeof value === "string" ? value : undefined
    return {
        id: user.id,
        firstName: text(user.first_name) ?? "",
        lastName: text(user.last_name),
        username: text(user.username),
        languageCode: text(user.language_code),
    }
}

/**
 * Checks Mini App initData signed by the bot with `botToken`.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export async function verifyInitData(
    initData: string,
    botToken: string,
    now: Date,
): Promise<VerifiedInitData | null> {
    const params = new URLSearchParams(initData)
    const hash = params.get("hash")
    if (!hash) {
        return null
    }
    params.delete("hash")
    const dataCheckString = [...params.entries()]
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join("\n")

    const secret = await hmacSha256(encoder.encode("WebAppData"), botToken)
    const expected = toHex(await hmacSha256(secret, dataCheckString))
    if (!timingSafeEqual(expected, hash)) {
        return null
    }

    const authDate = Number(params.get("auth_date"))
    const ageSeconds = now.getTime() / 1000 - authDate
    if (!Number.isFinite(authDate) || ageSeconds > INIT_DATA_MAX_AGE_SECONDS) {
        return null
    }
    if (ageSeconds < -CLOCK_SKEW_SECONDS) {
        return null
    }

    try {
        const user = parseUser(params.get("user"))
        if (!user) {
            return null
        }
        return {
            user,
            authDate: new Date(authDate * 1000),
            startParam: params.get("start_param") ?? undefined,
        }
    } catch {
        return null
    }
}

async function aesKey(keyBase64: string): Promise<CryptoKey> {
    return crypto.subtle.importKey("raw", fromBase64(keyBase64), "AES-GCM", false, [
        "encrypt",
        "decrypt",
    ])
}

/** AES-GCM; output is base64(iv ‖ ciphertext). */
export async function encryptSecret(plain: string, keyBase64: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(AES_IV_BYTES))
    const cipher = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        await aesKey(keyBase64),
        encoder.encode(plain),
    )
    const out = new Uint8Array(AES_IV_BYTES + cipher.byteLength)
    out.set(iv)
    out.set(new Uint8Array(cipher), AES_IV_BYTES)
    return toBase64(out)
}

export async function decryptSecret(encrypted: string, keyBase64: string): Promise<string> {
    const bytes = fromBase64(encrypted)
    const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bytes.slice(0, AES_IV_BYTES) },
        await aesKey(keyBase64),
        bytes.slice(AES_IV_BYTES),
    )
    return decoder.decode(plain)
}

/** URL-safe random token, e.g. for webhook secrets (Telegram allows A-Z a-z 0-9 _ -). */
export function randomToken(bytes = 32): string {
    return toBase64(crypto.getRandomValues(new Uint8Array(bytes)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
}

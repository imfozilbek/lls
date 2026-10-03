/**
 * Telegram Login in a plain browser: Telegram's `telegram-login.js` is replaced by a stub whose
 * window "confirms" at once and hands the page an `id_token` signed with the stand's key (the one
 * the fake Telegram publishes), the way Telegram's real window would.
 */
import { createSign, generateKeyPairSync } from "node:crypto"

import { businessBot } from "../stand/config.js"
import { STAND_LOGIN_KID, STAND_LOGIN_PRIVATE_JWK } from "../stand/login-key.js"

import type { TgUser } from "./telegram.js"
import type { Page } from "@playwright/test"
import type { JsonWebKey } from "node:crypto"

const ISSUER = "https://oauth.telegram.org"

const base64Url = (value: string | Buffer): string => Buffer.from(value).toString("base64url")

/** What Telegram's window answers for the next sign-in on this page. */
export interface LoginAnswer {
    user: TgUser | null
    /** Signed by some other key: the Worker must refuse it. */
    foreignKey?: boolean
    /** Claims to change, e.g. another bot's `aud`. */
    claims?: Record<string, unknown>
}

const foreign = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey

export function signIdToken(
    claims: Record<string, unknown>,
    key: JsonWebKey | "foreign" = STAND_LOGIN_PRIVATE_JWK,
): string {
    const head = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: STAND_LOGIN_KID }))
    const body = base64Url(JSON.stringify(claims))
    const signer = createSign("RSA-SHA256")
    signer.update(`${head}.${body}`)
    const signature = key === "foreign" ? signer.sign(foreign) : signer.sign({ key, format: "jwk" })
    return `${head}.${body}.${base64Url(signature)}`
}

/** The claims Telegram puts in the token for `user`, for our bot and our nonce. */
export function loginClaims(
    user: TgUser,
    options: { clientId: number; nonce?: string },
): Record<string, unknown> {
    const now = Math.floor(Date.now() / 1000)
    return {
        iss: ISSUER,
        aud: String(options.clientId),
        sub: `stand-${user.id}`,
        iat: now,
        exp: now + 3600,
        id: user.id,
        name: [user.first_name, user.last_name].filter(Boolean).join(" "),
        given_name: user.first_name,
        nonce: options.nonce,
    }
}

/** Installs the stub on `page`; `answer()` decides what each «Telegram orqali kirish» returns. */
export async function stubTelegramLogin(page: Page, answer: () => LoginAnswer): Promise<void> {
    await page.exposeFunction(
        "__telegramLogin",
        (options: { client_id: number; nonce?: string }): string | null => {
            const next = answer()
            if (!next.user) {
                return null
            }
            const claims = {
                ...loginClaims(next.user, { clientId: options.client_id, nonce: options.nonce }),
                ...next.claims,
            }
            return signIdToken(claims, next.foreignKey ? "foreign" : STAND_LOGIN_PRIVATE_JWK)
        },
    )
    await page.route("https://oauth.telegram.org/js/**", (route) =>
        route.fulfill({
            status: 200,
            contentType: "text/javascript",
            body: `window.Telegram = window.Telegram || {};
window.Telegram.Login = {
  auth: function (options, callback) {
    window.__telegramLogin(options).then(function (token) {
      callback(token ? { id_token: token } : { error: "popup_closed" });
    });
  },
};`,
        }),
    )
}

/** The Zumda | Business bot's Client ID, as the Worker hands it to the page. */
export function businessClientId(): number {
    return Number(businessBot().token.split(":")[0])
}

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { unauthorized } from "../http/errors.js"
import { loginBody, onInvalid } from "../http/schemas.js"
import { clientIdOf, issueLoginNonce, verifyLoginToken } from "../telegram-login.js"
import { issueSession } from "../web-session.js"

import type { AppEnv, Bindings } from "../env.js"

/**
 * Whose Telegram Login: Zumda | Business (business.zumda.shop) or Zumda | Platforma
 * (platform.zumda.shop). Each bot has its own Client ID and signs its own sessions and nonces,
 * so a sign-in to one never opens the other.
 */
export type WebBot = "business" | "admin"

function loginOf(env: Bindings, bot: WebBot): { token: string; secret: string } {
    return bot === "admin"
        ? { token: env.ADMIN_BOT_TOKEN, secret: env.ADMIN_SESSION_SECRET }
        : { token: env.BUSINESS_BOT_TOKEN, secret: env.BUSINESS_SESSION_SECRET }
}

/**
 * A Zumda bot's app in a browser, no initData here:
 * - `GET …/login`: what the page hands Telegram Login (the bot's Client ID and a nonce only this
 *   Worker can make);
 * - `POST …/session`: Telegram's `id_token` in, a 30-day session token out.
 */
export function webSessionRoutes(bot: WebBot): Hono<AppEnv> {
    return new Hono<AppEnv>()
        .get("/login", async (c) => {
            const now = c.get("services").clock.now()
            const { token, secret } = loginOf(c.env, bot)
            return c.json({
                clientId: clientIdOf(token),
                nonce: await issueLoginNonce(secret, now),
            })
        })

        .post("/session", zValidator("json", loginBody, onInvalid), async (c) => {
            const services = c.get("services")
            const now = services.clock.now()
            const keys = services.loginKeys
            const { token, secret } = loginOf(c.env, bot)
            const user = keys
                ? await verifyLoginToken(c.req.valid("json").idToken, {
                      clientId: clientIdOf(token),
                      keys,
                      nonceSecret: secret,
                      now,
                  })
                : null
            if (!user) {
                throw unauthorized()
            }
            const session = await issueSession(user, secret, now)
            return c.json({ ...session, user: { id: user.id, firstName: user.firstName } })
        })
}

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { unauthorized } from "../http/errors.js"
import { loginBody, onInvalid } from "../http/schemas.js"
import { clientIdOf, issueLoginNonce, verifyLoginToken } from "../telegram-login.js"
import { issueSession } from "../web-session.js"

import type { AppEnv } from "../env.js"

/**
 * Zumda | Business in a browser (business.zumda.shop), no initData here:
 * - `GET /api/business/login`: what the page hands Telegram Login (the bot's Client ID and a
 *   nonce only this Worker can make);
 * - `POST /api/business/session`: Telegram's `id_token` in, a 30-day session token out.
 */
export const webSessionRoutes = new Hono<AppEnv>()
    .get("/login", async (c) => {
        const now = c.get("services").clock.now()
        return c.json({
            clientId: clientIdOf(c.env.BUSINESS_BOT_TOKEN),
            nonce: await issueLoginNonce(c.env.BUSINESS_SESSION_SECRET, now),
        })
    })

    .post("/session", zValidator("json", loginBody, onInvalid), async (c) => {
        const services = c.get("services")
        const now = services.clock.now()
        const keys = services.loginKeys
        const user = keys
            ? await verifyLoginToken(c.req.valid("json").idToken, {
                  clientId: clientIdOf(c.env.BUSINESS_BOT_TOKEN),
                  keys,
                  nonceSecret: c.env.BUSINESS_SESSION_SECRET,
                  now,
              })
            : null
        if (!user) {
            throw unauthorized()
        }
        const session = await issueSession(user, c.env.BUSINESS_SESSION_SECRET, now)
        return c.json({ ...session, user: { id: user.id, firstName: user.firstName } })
    })

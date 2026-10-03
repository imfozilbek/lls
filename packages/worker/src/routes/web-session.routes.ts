import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { unauthorized } from "../http/errors.js"
import { onInvalid, widgetLoginBody } from "../http/schemas.js"
import { issueSession, verifyWidgetLogin } from "../web-session.js"

import type { AppEnv } from "../env.js"

/**
 * `POST /api/business/session`: the Telegram Login Widget's data of the Zumda | Business bot in,
 * a session token out. No initData here: this is the browser, outside Telegram.
 */
export const webSessionRoutes = new Hono<AppEnv>().post(
    "/session",
    zValidator("json", widgetLoginBody, onInvalid),
    async (c) => {
        const services = c.get("services")
        const fields = Object.fromEntries(
            Object.entries(c.req.valid("json")).map(([key, value]) => [key, String(value)]),
        )
        const now = services.clock.now()
        const user = await verifyWidgetLogin(fields, c.env.BUSINESS_BOT_TOKEN, now)
        if (!user) {
            throw unauthorized()
        }
        const session = await issueSession(user, c.env.BUSINESS_SESSION_SECRET, now)
        return c.json({ ...session, user: { id: user.id, firstName: user.firstName } })
    },
)

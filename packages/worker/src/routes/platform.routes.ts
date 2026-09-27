import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { ApiError } from "../http/errors.js"
import { rateLimit } from "../http/rate-limit.js"
import { onInvalid, registerShopBody } from "../http/schemas.js"
import { TelegramApiError } from "../telegram/gateway.js"
import { Notifier, inBackground } from "../telegram/notifier.js"

import type { AppEnv } from "../env.js"
import type { BotInfo, TelegramGateway } from "../telegram/gateway.js"

async function verifyBot(telegram: TelegramGateway, token: string): Promise<BotInfo> {
    try {
        const bot = await telegram.getMe(token)
        if (!bot.username) {
            throw new ApiError(400, "INVALID_BOT_TOKEN", "This token does not belong to a bot")
        }
        return bot
    } catch (error) {
        if (error instanceof TelegramApiError) {
            throw new ApiError(400, "INVALID_BOT_TOKEN", "Telegram did not accept this token")
        }
        throw error
    }
}

/** Onboarding through the LLS platform bot (no `X-Shop`). */
export const platformRoutes = new Hono<AppEnv>()
    .use(async (c, next) => {
        if (c.get("auth").business) {
            throw new ApiError(400, "PLATFORM_ONLY", "Open this from the LLS bot")
        }
        await next()
    })

    .get("/shops", async (c) => {
        const shops = await c.get("services").useCases.listMyShops.execute(c.get("auth").user.id)
        return c.json(shops)
    })

    .post(
        "/shops",
        rateLimit("SIGNUP_LIMITER"),
        zValidator("json", registerShopBody, onInvalid),
        async (c) => {
            const services = c.get("services")
            const { botToken, ...shop } = c.req.valid("json")
            const bot = await verifyBot(services.telegram, botToken)
            const registered = await services.useCases.registerShop.execute({
                ...shop,
                ownerTelegramId: c.get("auth").user.id,
                bot: { id: bot.id, username: bot.username, token: botToken },
            })
            inBackground(
                c.executionCtx,
                services,
                new Notifier(services).shopRegistered(registered),
            )
            return c.json(registered, 201)
        },
    )

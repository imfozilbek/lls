import { zValidator } from "@hono/zod-validator"
import { languageFromTelegram } from "@zumda/core"
import { Hono } from "hono"

import { ApiError } from "../http/errors.js"
import { readJpeg } from "../http/images.js"
import { rateLimit } from "../http/rate-limit.js"
import { idParam, onInvalid, prepareManagedBotBody, registerShopBody } from "../http/schemas.js"
import { TelegramApiError } from "../telegram/gateway.js"
import { newBotLink, randomRequestId, suggestBotUsername } from "../telegram/managed-bots.js"
import { refreshManagedBotToken } from "../telegram/managed-token.js"
import { Notifier, inBackground } from "../telegram/notifier.js"
import { textsFor } from "../telegram/texts.js"

import { isPlatformAdmin } from "./admin.routes.js"
import { setShopBotPhoto } from "./owner.routes.js"

import type { AppEnv } from "../env.js"
import type { Services } from "../services.js"
import type { BotInfo, TelegramGateway } from "../telegram/gateway.js"
import type { RegisterShopInput } from "@zumda/core"

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

/** The application's bot: a pasted BotFather token, or a bot the owner created from Zumda. */
async function chosenBot(
    services: Services,
    choice: { botToken?: string; managedBotId?: number },
    ownerTelegramId: number,
): Promise<RegisterShopInput["bot"]> {
    if (choice.managedBotId !== undefined) {
        // Only the owner's own bot gets a fresh token here; any other id fails in the use case.
        const record = await services.managedBots.find(choice.managedBotId)
        if (record?.ownerTelegramId === ownerTelegramId && !record.businessId) {
            await refreshManagedBotToken(services, record.botId).catch((error: unknown) => {
                // Telegram is down for a moment: the saved token is used; approval asks again.
                if (!(error instanceof TelegramApiError)) {
                    throw error
                }
            })
        }
        return { managedBotId: choice.managedBotId }
    }
    const token = choice.botToken ?? ""
    const bot = await verifyBot(services.telegram, token)
    return { id: bot.id, username: bot.username, token }
}

/**
 * «Mening bizneslarim» and applications: only from the Zumda Business bot (`X-Bot: business`,
 * no `X-Shop`). The customers' Zumda bot cannot open them.
 */
export const platformRoutes = new Hono<AppEnv>()
    .use(async (c, next) => {
        const { business, role } = c.get("auth")
        if (business) {
            throw new ApiError(400, "PLATFORM_ONLY", "Open this from the Zumda Business bot")
        }
        if (role !== "business") {
            throw new ApiError(403, "BUSINESS_BOT_ONLY", "Open this from the Zumda Business bot")
        }
        await next()
    })

    /** Who opened Zumda | Business: a platform admin also sees «Platforma». */
    .get("/me", (c) => {
        const { user } = c.get("auth")
        return c.json({ admin: isPlatformAdmin(c.get("services"), user.id) })
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
            const auth = c.get("auth")
            const { botToken, managedBotId, ...shop } = c.req.valid("json")
            const bot = await chosenBot(services, { botToken, managedBotId }, auth.user.id)
            // The Zumda bot signed this: remember the owner's name and language for the bots.
            await services.useCases.resolveCustomer.execute(auth.user, auth.scope)
            const registered = await services.useCases.registerShop.execute({
                ...shop,
                ownerTelegramId: auth.user.id,
                bot,
            })
            inBackground(
                c.executionCtx,
                services,
                new Notifier(services).shopRegistered(registered),
            )
            return c.json(registered, 201)
        },
    )

    /**
     * Step «Bot»: a prepared button the app opens with `WebApp.requestChat(preparedId)`. Telegram
     * shows its «new bot» window with the shop's name; the bot is created in the owner's own
     * account and managed by the Zumda Business bot, and `managed_bot` brings us its token. `link` opens
     * the same window from Telegram apps that cannot do `requestChat`.
     */
    .post(
        "/managed-bot/prepare",
        rateLimit("SIGNUP_LIMITER"),
        zValidator("json", prepareManagedBotBody, onInvalid),
        async (c) => {
            const services = c.get("services")
            const { user } = c.get("auth")
            const { name } = c.req.valid("json")
            const managerToken = services.env.BUSINESS_BOT_TOKEN
            const username = suggestBotUsername(name)
            const preparedId = await services.telegram.savePreparedKeyboardButton(
                managerToken,
                user.id,
                {
                    text: textsFor(languageFromTelegram(user.languageCode)).managedBotButton,
                    requestId: randomRequestId(),
                    suggestedName: name,
                    suggestedUsername: username,
                },
            )
            const manager = await services.telegram.getMe(managerToken)
            return c.json({ preparedId, link: newBotLink(manager.username, username, name) })
        },
    )

    /** The owner's bots created from Zumda that wait for their application. */
    .get("/managed-bots", async (c) => {
        const services = c.get("services")
        const bots = await services.useCases.listMyManagedBots.execute(c.get("auth").user.id)
        return c.json({ data: bots })
    })

    /** Right after connecting: the new bot gets its picture (the shop's name + the Zumda mark). */
    .put("/shops/:id/bot-photo", zValidator("param", idParam, onInvalid), async (c) => {
        const services = c.get("services")
        const { id } = c.req.valid("param")
        const mine = await services.useCases.listMyShops.execute(c.get("auth").user.id)
        if (!mine.some((shop) => shop.id === id)) {
            throw new ApiError(404, "NOT_FOUND", "Shop not found")
        }
        await setShopBotPhoto(services, id, await readJpeg(c.req.raw))
        return c.body(null, 204)
    })

import { DomainError, ForbiddenError, languageFromTelegram } from "@lls/core"
import { Hono } from "hono"
import { z } from "zod"

import { timingSafeEqual } from "../crypto.js"
import { parseOrderCallback, parseReviewCallback } from "../telegram/format.js"
import { escapeHtml } from "../telegram/gateway.js"
import { Notifier, onboardingAppUrl, shopAppUrl } from "../telegram/notifier.js"
import { fill, textsFor } from "../telegram/texts.js"

import type { AppEnv } from "../env.js"
import type { Services } from "../services.js"
import type { Business, OrderDTO, TelegramUser } from "@lls/core"

const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"

const userSchema = z.object({
    id: z.number().int(),
    first_name: z.string().default(""),
    last_name: z.string().optional(),
    username: z.string().optional(),
    language_code: z.string().optional(),
})

const updateSchema = z.object({
    message: z
        .object({
            from: userSchema.optional(),
            chat: z.object({ id: z.number().int() }),
            text: z.string().optional(),
            contact: z
                .object({ phone_number: z.string(), user_id: z.number().int().optional() })
                .optional(),
        })
        .optional(),
    callback_query: z
        .object({
            id: z.string(),
            from: userSchema,
            data: z.string().optional(),
            message: z
                .object({ message_id: z.number().int(), chat: z.object({ id: z.number().int() }) })
                .optional(),
        })
        .optional(),
})

type Update = z.infer<typeof updateSchema>
type Callback = NonNullable<Update["callback_query"]>

function toTelegramUser(user: z.infer<typeof userSchema>): TelegramUser {
    return {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        languageCode: user.language_code,
    }
}

async function readUpdate(request: Request): Promise<Update | null> {
    const parsed = updateSchema.safeParse(await request.json().catch(() => null))
    return parsed.success ? parsed.data : null
}

function isStart(text: string | undefined): boolean {
    return text?.trim().startsWith("/start") ?? false
}

async function handleShopMessage(
    services: Services,
    business: Business,
    token: string,
    message: NonNullable<Update["message"]>,
): Promise<void> {
    const from = message.from
    if (!from) {
        return
    }
    const texts = textsFor(languageFromTelegram(from.language_code))
    if (message.contact) {
        // Only the sender's own contact counts: a forwarded contact must not change anyone's phone.
        if (message.contact.user_id !== from.id) {
            return
        }
        await services.useCases.updateCustomer.execute({
            user: toTelegramUser(from),
            phone: message.contact.phone_number,
        })
        await services.telegram.sendMessage(token, message.chat.id, texts.phoneSaved)
        return
    }
    if (isStart(message.text)) {
        await services.telegram.sendMessage(
            token,
            message.chat.id,
            fill(texts.shopWelcome, { shop: `<b>${escapeHtml(business.name)}</b>` }),
            {
                keyboard: {
                    inline_keyboard: [
                        [
                            {
                                text: texts.openMenu,
                                web_app: {
                                    url: shopAppUrl(services.env.APP_ORIGIN, business.slug.value),
                                },
                            },
                        ],
                    ],
                },
            },
        )
    }
}

function callbackErrorText(error: unknown, texts: ReturnType<typeof textsFor>): string {
    if (error instanceof ForbiddenError) {
        return texts.callbackForbidden
    }
    if (error instanceof DomainError) {
        return texts.callbackOutdated
    }
    throw error
}

async function handleOrderCallback(
    services: Services,
    business: Business,
    token: string,
    callback: Callback,
): Promise<void> {
    const texts = textsFor(languageFromTelegram(callback.from.language_code))
    const action = parseOrderCallback(callback.data ?? "")
    if (!action) {
        await services.telegram.answerCallback(token, callback.id)
        return
    }
    let order: OrderDTO
    try {
        order =
            action.kind === "advance"
                ? await services.useCases.advanceOrder.execute({
                      actorTelegramId: callback.from.id,
                      orderId: action.orderId,
                      to: action.to,
                  })
                : await requireOwnerCancel(services, business, callback.from.id, action.orderId)
    } catch (error) {
        await services.telegram.answerCallback(token, callback.id, callbackErrorText(error, texts))
        return
    }
    await services.telegram.answerCallback(token, callback.id, texts.callbackDone)
    await new Notifier(services).orderChanged(business, order)
}

/** Cancel buttons live only in the owner's chat, but check ownership anyway. */
async function requireOwnerCancel(
    services: Services,
    business: Business,
    actorTelegramId: number,
    orderId: string,
): Promise<OrderDTO> {
    if (!business.isOwnedBy(actorTelegramId)) {
        throw ForbiddenError.notOwner(business.id)
    }
    return services.useCases.cancelOrder.execute({ telegramId: actorTelegramId, orderId })
}

async function handleReviewCallback(
    services: Services,
    callback: Callback,
    workerOrigin: string,
): Promise<void> {
    const token = services.env.PLATFORM_BOT_TOKEN
    const review = parseReviewCallback(callback.data ?? "")
    if (!review) {
        await services.telegram.answerCallback(token, callback.id)
        return
    }
    try {
        const shop = await services.useCases.reviewShop.execute({
            actorTelegramId: callback.from.id,
            businessId: review.businessId,
            decision: review.decision,
        })
        await services.telegram.answerCallback(token, callback.id, shop.status)
        if (callback.message) {
            await services.telegram.editMessage(
                token,
                callback.message.chat.id,
                callback.message.message_id,
                `🏪 <b>${escapeHtml(shop.name)}</b> — ${shop.status}`,
            )
        }
        await new Notifier(services).shopReviewed(shop, workerOrigin)
    } catch (error) {
        if (!(error instanceof DomainError)) {
            throw error
        }
        await services.telegram.answerCallback(token, callback.id, error.message)
    }
}

/** Telegram webhooks. Always answer 200 to valid updates so Telegram does not retry. */
export const webhookRoutes = new Hono<AppEnv>()
    .post("/platform", async (c) => {
        const secret = c.req.header(SECRET_HEADER) ?? ""
        if (!timingSafeEqual(secret, c.env.PLATFORM_WEBHOOK_SECRET)) {
            return c.json({ ok: false }, 401)
        }
        const services = c.get("services")
        const update = await readUpdate(c.req.raw)
        const message = update?.message
        if (message?.from && isStart(message.text)) {
            const texts = textsFor(languageFromTelegram(message.from.language_code))
            await services.telegram.sendMessage(
                c.env.PLATFORM_BOT_TOKEN,
                message.chat.id,
                texts.platformWelcome,
                {
                    keyboard: {
                        inline_keyboard: [
                            [
                                {
                                    text: texts.connectShop,
                                    web_app: { url: onboardingAppUrl(c.env.APP_ORIGIN) },
                                },
                            ],
                        ],
                    },
                },
            )
        }
        if (update?.callback_query) {
            await handleReviewCallback(services, update.callback_query, new URL(c.req.url).origin)
        }
        return c.json({ ok: true })
    })

    .post("/:botId", async (c) => {
        const services = c.get("services")
        const botId = Number(c.req.param("botId"))
        const business = Number.isSafeInteger(botId)
            ? await services.businesses.findByBotId(botId)
            : null
        const credentials = business
            ? await services.businesses.getBotCredentials(business.id)
            : null
        if (!business || !credentials) {
            return c.json({ ok: false }, 404)
        }
        const secret = c.req.header(SECRET_HEADER) ?? ""
        if (!timingSafeEqual(secret, credentials.webhookSecret)) {
            return c.json({ ok: false }, 401)
        }
        const update = await readUpdate(c.req.raw)
        if (update?.message) {
            await handleShopMessage(services, business, credentials.token, update.message)
        }
        if (update?.callback_query) {
            await handleOrderCallback(services, business, credentials.token, update.callback_query)
        }
        return c.json({ ok: true })
    })

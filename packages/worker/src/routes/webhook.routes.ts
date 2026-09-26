import { DomainError, ForbiddenError, Phone, languageFromTelegram } from "@lls/core"
import { Hono } from "hono"
import { z } from "zod"

import { timingSafeEqual } from "../crypto.js"
import { parseCourierInvite, parseOrderCallback, parseReviewCallback } from "../telegram/format.js"
import { TelegramApiError, escapeHtml } from "../telegram/gateway.js"
import { Notifier, courierAppUrl, onboardingAppUrl, shopAppUrl } from "../telegram/notifier.js"
import { fill, textsFor } from "../telegram/texts.js"

import type { AppEnv } from "../env.js"
import type { Services } from "../services.js"
import type { InlineKeyboard } from "../telegram/gateway.js"
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
type ShopMessage = NonNullable<Update["message"]>

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

function openButton(label: string, url: string): InlineKeyboard {
    return { inline_keyboard: [[{ text: label, web_app: { url } }]] }
}

/** `/start c_<code>`: the sender joins the shop as a courier. */
async function joinAsCourier(
    services: Services,
    business: Business,
    token: string,
    message: ShopMessage,
    code: string,
): Promise<void> {
    const from = message.from
    if (!from) {
        return
    }
    const texts = textsFor(languageFromTelegram(from.language_code), business.type)
    try {
        const courier = await services.useCases.joinAsCourier.execute({
            code,
            businessId: business.id,
            user: toTelegramUser(from),
        })
        await services.telegram.sendMessage(
            token,
            message.chat.id,
            fill(texts.courierJoined, { shop: `<b>${escapeHtml(business.name)}</b>` }),
            {
                keyboard: openButton(
                    texts.myDeliveries,
                    courierAppUrl(services.env.APP_ORIGIN, business.slug.value),
                ),
            },
        )
        await new Notifier(services).courierJoined(business, courier.name)
    } catch (error) {
        if (!(error instanceof DomainError)) {
            throw error
        }
        await services.telegram.sendMessage(token, message.chat.id, texts.inviteInvalid)
    }
}

/** A shared contact: the customer's phone, and the courier's too if the sender is one. */
async function saveContact(
    services: Services,
    business: Business,
    token: string,
    message: ShopMessage,
): Promise<void> {
    const { from, contact } = message
    // Only the sender's own contact counts: a forwarded contact must not change anyone's phone.
    if (!from || !contact || contact.user_id !== from.id) {
        return
    }
    await services.useCases.updateCustomer.execute({
        user: toTelegramUser(from),
        phone: contact.phone_number,
    })
    const courier = await services.couriers.findByTelegramId(business.id, from.id)
    if (courier) {
        courier.setPhone(Phone.create(contact.phone_number), services.clock.now())
        await services.couriers.save(courier)
    }
    const texts = textsFor(languageFromTelegram(from.language_code), business.type)
    await services.telegram.sendMessage(token, message.chat.id, texts.phoneSaved)
}

async function handleShopMessage(
    services: Services,
    business: Business,
    token: string,
    message: ShopMessage,
): Promise<void> {
    const from = message.from
    if (!from) {
        return
    }
    if (message.contact) {
        await saveContact(services, business, token, message)
        return
    }
    const invite = parseCourierInvite(message.text)
    if (invite) {
        await joinAsCourier(services, business, token, message, invite)
        return
    }
    if (!isStart(message.text)) {
        return
    }
    const texts = textsFor(languageFromTelegram(from.language_code), business.type)
    const origin = services.env.APP_ORIGIN
    const courier = await services.couriers.findByTelegramId(business.id, from.id)
    const keyboard = openButton(texts.openMenu, shopAppUrl(origin, business.slug.value))
    if (courier?.worksFor(business.id)) {
        keyboard.inline_keyboard.push([
            {
                text: texts.myDeliveries,
                web_app: { url: courierAppUrl(origin, business.slug.value) },
            },
        ])
    }
    await services.telegram.sendMessage(
        token,
        message.chat.id,
        fill(texts.shopWelcome, { shop: `<b>${escapeHtml(business.name)}</b>` }),
        { keyboard },
    )
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
    const texts = textsFor(languageFromTelegram(callback.from.language_code), business.type)
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
                      businessId: business.id,
                      orderId: action.orderId,
                      to: action.to,
                  })
                : await requireOwnerCancel(services, business, callback.from.id, action.orderId)
    } catch (error) {
        await services.telegram.answerCallback(token, callback.id, callbackErrorText(error, texts))
        return
    }
    // Notify first: if answering the button fails, the owner card and the customer still update.
    await new Notifier(services).orderChanged(business, order)
    await services.telegram.answerCallback(token, callback.id, texts.callbackDone)
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
    return services.useCases.cancelOrder.execute({
        telegramId: actorTelegramId,
        businessId: business.id,
        orderId,
    })
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
        // Connect the shop bot first: a failed card edit or answer must not skip it.
        await new Notifier(services).shopReviewed(shop, workerOrigin)
        const texts = textsFor(languageFromTelegram(callback.from.language_code))
        const status = texts.shopStatus[shop.status]
        if (callback.message) {
            await services.telegram.editMessage(
                token,
                callback.message.chat.id,
                callback.message.message_id,
                `🏪 <b>${escapeHtml(shop.name)}</b> — ${status}`,
            )
        }
        await services.telegram.answerCallback(token, callback.id, status)
    } catch (error) {
        if (!(error instanceof DomainError)) {
            throw error
        }
        await services.telegram.answerCallback(token, callback.id, error.message)
    }
}

/**
 * Runs an update handler. A failed reply (bot blocked, query too old, Telegram down) is logged,
 * not thrown: the update is already applied, and a 500 would make Telegram resend it for hours.
 */
async function handleSafely(work: () => Promise<void>): Promise<void> {
    try {
        await work()
    } catch (error) {
        if (!(error instanceof TelegramApiError)) {
            throw error
        }
        console.error("Telegram reply failed:", error.message)
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
        const from = message?.from
        if (message && from && isStart(message.text)) {
            const texts = textsFor(languageFromTelegram(from.language_code))
            await handleSafely(() =>
                services.telegram
                    .sendMessage(c.env.PLATFORM_BOT_TOKEN, message.chat.id, texts.platformWelcome, {
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
                    })
                    .then(() => undefined),
            )
        }
        if (update?.callback_query) {
            const callback = update.callback_query
            await handleSafely(() =>
                handleReviewCallback(services, callback, new URL(c.req.url).origin),
            )
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
        const message = update?.message
        if (message) {
            await handleSafely(() =>
                handleShopMessage(services, business, credentials.token, message),
            )
        }
        const callback = update?.callback_query
        if (callback) {
            await handleSafely(() =>
                handleOrderCallback(services, business, credentials.token, callback),
            )
        }
        return c.json({ ok: true })
    })

import { ForbiddenError, languageFromTelegram } from "@zumda/core"
import { Hono } from "hono"

import { timingSafeEqual } from "../crypto.js"
import { networkAfterStep, notifyOwnerStep, notifyPaymentConfirmed } from "../network-flow.js"
import { parseCourierReviewCallback, parseOrderCallback } from "../telegram/format.js"
import { escapeHtml } from "../telegram/gateway.js"
import { handleManagedBot } from "../telegram/managed-bots.js"
import { Notifier, shopAppUrl, showcaseAppUrl } from "../telegram/notifier.js"
import { fill, textsFor } from "../telegram/texts.js"
import {
    SECRET_HEADER,
    callbackErrorText,
    handleSafely,
    isStart,
    openButton,
    readUpdate,
    toTelegramUser,
} from "../telegram/updates.js"
import { sendWelcome, welcomePictureUrl } from "../telegram/welcome.js"

import { handleBusinessMessage, handleReviewCallback } from "./business-bot.js"
import { handleCourierBotCallback, handleCourierBotMessage } from "./courier-bot.js"

import type { AppEnv } from "../env.js"
import type { Services } from "../services.js"
import type { OrderCallback } from "../telegram/format.js"
import type { Callback, IncomingMessage } from "../telegram/updates.js"
import type { Business, OrderDTO } from "@zumda/core"

/**
 * Saves the customer's phone from a shared contact. Only the sender's own contact counts:
 * a forwarded contact must not change anyone's phone. Returns false when nothing was saved.
 */
async function saveOwnPhone(
    services: Services,
    message: IncomingMessage,
    businessId?: string,
): Promise<boolean> {
    const { from, contact } = message
    if (!from || !contact || contact.user_id !== from.id) {
        return false
    }
    // Delivered by Telegram to this bot's webhook: the phone is real and shared with this shop.
    await services.useCases.saveContact.execute({
        user: toTelegramUser(from),
        phone: contact.phone_number,
        businessId,
        now: services.clock.now(),
    })
    return true
}

/** A shared contact: the customer's phone for this shop. */
async function saveContact(
    services: Services,
    business: Business,
    token: string,
    message: IncomingMessage,
): Promise<void> {
    const { from } = message
    if (!from || !(await saveOwnPhone(services, message, business.id))) {
        return
    }
    const texts = textsFor(languageFromTelegram(from.language_code), business.type)
    await services.telegram.sendMessage(token, message.chat.id, texts.phoneSaved)
}

async function handleShopMessage(
    services: Services,
    business: Business,
    token: string,
    message: IncomingMessage,
): Promise<void> {
    const from = message.from
    if (!from) {
        return
    }
    if (message.contact) {
        await saveContact(services, business, token, message)
        return
    }
    if (!isStart(message.text)) {
        return
    }
    const texts = textsFor(languageFromTelegram(from.language_code), business.type)
    const keyboard = openButton(
        texts.openMenu,
        shopAppUrl(services.env.APP_ORIGIN, business.slug.value),
    )
    await services.telegram.sendMessage(
        token,
        message.chat.id,
        fill(texts.shopWelcome, { shop: `<b>${escapeHtml(business.name)}</b>` }),
        { keyboard },
    )
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
        order = await runOrderAction(services, business, callback.from.id, action)
    } catch (error) {
        await services.telegram.answerCallback(token, callback.id, callbackErrorText(error, texts))
        return
    }
    const step = await networkAfterStep(services, order)
    // Notify first: if answering the button fails, the owner card and the customer still update.
    if (action.kind === "paid") {
        await notifyPaymentConfirmed(services, business, step.order, step.request)
    } else {
        await notifyOwnerStep(services, business, step.order, step.request)
    }
    await services.telegram.answerCallback(token, callback.id, texts.callbackDone)
}

/** The owner's button: the next step, «Деньги пришли, принять», or cancel. */
async function runOrderAction(
    services: Services,
    business: Business,
    actorTelegramId: number,
    action: OrderCallback,
): Promise<OrderDTO> {
    const ids = { actorTelegramId, businessId: business.id, orderId: action.orderId }
    switch (action.kind) {
        case "advance":
            return services.useCases.advanceOrder.execute({ ...ids, to: action.to })
        case "paid":
            return services.useCases.confirmPayment.execute(ids)
        case "cancel":
            return requireOwnerCancel(services, business, actorTelegramId, action.orderId)
    }
}

/** "k:<courierId>:approve|decline": the owner answers a courier who accepted the invite. */
async function handleCourierReviewCallback(
    services: Services,
    business: Business,
    token: string,
    callback: Callback,
    review: { courierId: string; approve: boolean },
): Promise<void> {
    const texts = textsFor(languageFromTelegram(callback.from.language_code), business.type)
    try {
        const change = await services.useCases.reviewCourier.execute({
            actorTelegramId: callback.from.id,
            businessId: business.id,
            courierId: review.courierId,
            approve: review.approve,
        })
        const name = escapeHtml(change.courier.name)
        if (callback.message) {
            await services.telegram.editMessage(
                token,
                callback.message.chat.id,
                callback.message.message_id,
                fill(review.approve ? texts.courierApprovedOwner : texts.courierDeclinedOwner, {
                    name,
                }),
            )
        }
        await new Notifier(services).courierReviewed(business, change.courier, change.telegramId)
        await services.telegram.answerCallback(token, callback.id, texts.callbackDone)
    } catch (error) {
        await services.telegram.answerCallback(token, callback.id, callbackErrorText(error, texts))
    }
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

/** The Zumda bot (customers): welcome with the showcase, and phones. */
async function handlePlatformMessage(services: Services, message: IncomingMessage): Promise<void> {
    const from = message.from
    if (!from) {
        return
    }
    const token = services.env.PLATFORM_BOT_TOKEN
    const texts = textsFor(languageFromTelegram(from.language_code))
    if (message.contact) {
        if (await saveOwnPhone(services, message)) {
            await services.telegram.sendMessage(token, message.chat.id, texts.phoneSaved)
        }
        return
    }
    if (isStart(message.text)) {
        const origin = services.env.APP_ORIGIN
        await sendWelcome(services.telegram, {
            token,
            chatId: message.chat.id,
            pictureUrl: welcomePictureUrl(origin, "platform"),
            html: texts.platformWelcome,
            options: {
                keyboard: {
                    inline_keyboard: [
                        [{ text: texts.openShowcase, web_app: { url: showcaseAppUrl(origin) } }],
                    ],
                },
            },
        })
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
        if (message) {
            await handleSafely(() => handlePlatformMessage(services, message))
        }
        // Approval cards an admin got from this bot before Zumda Biznes took them over.
        const callback = update?.callback_query
        if (callback) {
            const origin = new URL(c.req.url).origin
            await handleSafely(() =>
                handleReviewCallback(services, services.env.PLATFORM_BOT_TOKEN, callback, origin),
            )
        }
        return c.json({ ok: true })
    })

    /** The Zumda Biznes bot: owners, applications, admins' commands, bots it manages. */
    .post("/business", async (c) => {
        const secret = c.req.header(SECRET_HEADER) ?? ""
        if (!timingSafeEqual(secret, c.env.BUSINESS_WEBHOOK_SECRET)) {
            return c.json({ ok: false }, 401)
        }
        const services = c.get("services")
        const update = await readUpdate(c.req.raw)
        const origin = new URL(c.req.url).origin
        const message = update?.message
        if (message) {
            await handleSafely(() => handleBusinessMessage(services, message, origin))
        }
        const callback = update?.callback_query
        if (callback) {
            await handleSafely(() =>
                handleReviewCallback(services, services.env.BUSINESS_BOT_TOKEN, callback, origin),
            )
        }
        const managed = update?.managed_bot
        if (managed) {
            await handleSafely(() => handleManagedBot(services, managed, origin))
        }
        return c.json({ ok: true })
    })

    /** The Zumda courier bot: invites, phones, and the buttons on order cards of every shop. */
    .post("/courier", async (c) => {
        const secret = c.req.header(SECRET_HEADER) ?? ""
        if (!timingSafeEqual(secret, c.env.COURIER_WEBHOOK_SECRET)) {
            return c.json({ ok: false }, 401)
        }
        const services = c.get("services")
        const update = await readUpdate(c.req.raw)
        const message = update?.message
        if (message) {
            await handleSafely(() => handleCourierBotMessage(services, message))
        }
        const callback = update?.callback_query
        if (callback) {
            await handleSafely(() => handleCourierBotCallback(services, callback))
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
        const review = callback ? parseCourierReviewCallback(callback.data ?? "") : null
        if (callback && review) {
            await handleSafely(() =>
                handleCourierReviewCallback(
                    services,
                    business,
                    credentials.token,
                    callback,
                    review,
                ),
            )
        } else if (callback) {
            await handleSafely(() =>
                handleOrderCallback(services, business, credentials.token, callback),
            )
        }
        return c.json({ ok: true })
    })

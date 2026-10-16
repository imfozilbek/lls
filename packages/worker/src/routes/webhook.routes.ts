import { ForbiddenError, OrderStatus, languageFromTelegram } from "@zumda/core"
import { Hono } from "hono"

import { timingSafeEqual } from "../crypto.js"
import { networkAfterStep, notifyOwnerStep, notifyPaymentConfirmed } from "../network-flow.js"
import { appKeyboard, shopAppUrl, showcaseAppUrl } from "../telegram/app-links.js"
import { saveOwnPhone } from "../telegram/contacts.js"
import { parseCourierReviewCallback, parseOrderCallback } from "../telegram/format.js"
import { escapeHtml } from "../telegram/gateway.js"
import { handleManagedBot } from "../telegram/managed-bots.js"
import { Notifier, everyOne } from "../telegram/notifier.js"
import { fill, textsFor } from "../telegram/texts.js"
import {
    SECRET_HEADER,
    callbackErrorText,
    handleSafely,
    isStart,
    readUpdate,
} from "../telegram/updates.js"
import { sendWelcome, welcomePictureUrl, welcomeVideo } from "../telegram/welcome.js"

import { handleBusinessMessage, handleReviewCallback } from "./business-bot.js"
import { handleCourierBotCallback, handleCourierBotMessage } from "./courier-bot.js"

import type { AppEnv } from "../env.js"
import type { Services } from "../services.js"
import type { OrderCallback } from "../telegram/format.js"
import type { BotTexts } from "../telegram/texts.js"
import type { Callback, IncomingMessage } from "../telegram/updates.js"
import type { Business, OrderDTO } from "@zumda/core"

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

/**
 * The owner pressed Start in the shop's own bot: from now on it may write to them, so orders and
 * files come there instead of Zumda | Business.
 */
async function ownerStarted(
    services: Services,
    business: Business,
    token: string,
    message: { chatId: number; texts: BotTexts },
): Promise<void> {
    if (business.ownerChatOpened(services.clock.now())) {
        await services.businesses.saveOwnerChat(business)
    }
    const { chatId, texts: t } = message
    await services.telegram.sendMessage(
        token,
        chatId,
        fill(t.ownerBotOpened, { shop: `<b>${escapeHtml(business.name)}</b>` }),
        {
            keyboard: appKeyboard(
                t.openMyShop,
                shopAppUrl(services.env.APP_ORIGIN, business.slug.value),
            ),
        },
    )
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
    const texts = textsFor(languageFromTelegram(from.language_code), business.type)
    const keyboard = appKeyboard(
        texts.openMenu,
        shopAppUrl(services.env.APP_ORIGIN, business.slug.value),
    )
    // A shop turned off (or a rejected application): its app answers 404, so no button to it.
    if (!business.isVisibleTo(from.id)) {
        await services.telegram.sendMessage(
            token,
            message.chat.id,
            fill(texts.shopNotWorking, { shop: `<b>${escapeHtml(business.name)}</b>` }),
        )
        return
    }
    if (!isStart(message.text)) {
        await services.telegram.sendMessage(token, message.chat.id, texts.onlyInApp, { keyboard })
        return
    }
    if (from.id === business.ownerTelegramId.value) {
        await ownerStarted(services, business, token, { chatId: message.chat.id, texts })
        return
    }
    // Waiting for approval: the bot already answers, the shop opens soon.
    const welcome = business.isPending() ? texts.shopOpensSoon : texts.shopWelcome
    await services.telegram.sendMessage(
        token,
        message.chat.id,
        fill(welcome, { shop: `<b>${escapeHtml(business.name)}</b>` }),
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
    if (action.kind === "askPaid") {
        await askPaymentConfirm(services, business, token, callback, action.orderId)
        return
    }
    let order: OrderDTO
    try {
        order = await runOrderAction(services, business, callback.from.id, action)
    } catch (error) {
        await services.telegram.answerCallback(token, callback.id, callbackErrorText(error, texts))
        return
    }
    const accepted =
        action.kind === "paid" || (action.kind === "advance" && action.to === OrderStatus.ACCEPTED)
    const step = await networkAfterStep(services, order, accepted)
    // Notify first: if answering the button fails, the owner card and the customer still update.
    // A failed notification (a customer blocked the bot) still answers the button: the step is
    // done, and a spinning button would say otherwise.
    try {
        if (action.kind === "paid") {
            await notifyPaymentConfirmed(services, business, step.order, step.request)
        } else if (action.kind === "notPaid") {
            await new Notifier(services).transferRejected(business, order)
        } else {
            await notifyOwnerStep(services, business, step.order, step.request)
        }
    } finally {
        await services.telegram.answerCallback(token, callback.id, texts.callbackDone)
    }
    // A stop cancelled from the chat leaves the trip's way, as from the app.
    if (order.tripId && order.status === OrderStatus.CANCELLED) {
        await services.useCases.refreshTripRoute.execute({ tripId: order.tripId })
    }
}

/** «Pul keldi» in the chat asks first: the sum and the card to check in the bank app. */
async function askPaymentConfirm(
    services: Services,
    business: Business,
    token: string,
    callback: Callback,
    orderId: string,
): Promise<void> {
    const texts = textsFor(languageFromTelegram(callback.from.language_code), business.type)
    try {
        if (!business.isOwnedBy(callback.from.id)) {
            throw ForbiddenError.notOwner(business.id)
        }
        const order = await services.useCases.getOrder.execute({
            telegramId: callback.from.id,
            businessId: business.id,
            orderId,
        })
        await new Notifier(services).askPaymentConfirm(business, order)
    } catch (error) {
        await services.telegram.answerCallback(token, callback.id, callbackErrorText(error, texts))
        return
    }
    await services.telegram.answerCallback(token, callback.id)
}

/** The owner's button: the next step, the money here or not, or cancel. */
async function runOrderAction(
    services: Services,
    business: Business,
    actorTelegramId: number,
    action: Exclude<OrderCallback, { kind: "askPaid" }>,
): Promise<OrderDTO> {
    const ids = { actorTelegramId, businessId: business.id, orderId: action.orderId }
    switch (action.kind) {
        case "advance":
            return services.useCases.advanceOrder.execute({ ...ids, to: action.to })
        case "paid":
            return services.useCases.confirmPayment.execute(ids)
        case "notPaid":
            return services.useCases.rejectTransfer.execute(ids)
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
    let change: Awaited<ReturnType<typeof services.useCases.reviewCourier.execute>>
    try {
        change = await services.useCases.reviewCourier.execute({
            actorTelegramId: callback.from.id,
            businessId: business.id,
            courierId: review.courierId,
            approve: review.approve,
        })
    } catch (error) {
        await services.telegram.answerCallback(token, callback.id, callbackErrorText(error, texts))
        return
    }
    // Saved: the button answers, and the courier hears it even if the old card cannot change.
    await services.telegram.answerCallback(token, callback.id, texts.callbackDone)
    const name = escapeHtml(change.courier.name)
    const message = callback.message
    await everyOne([
        async (): Promise<void> => {
            if (message) {
                await services.telegram.editMessage(
                    token,
                    message.chat.id,
                    message.message_id,
                    fill(review.approve ? texts.courierApprovedOwner : texts.courierDeclinedOwner, {
                        name,
                    }),
                )
            }
        },
        (): Promise<void> =>
            new Notifier(services).courierReviewed(business, change.courier, change.telegramId),
    ])
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
    const origin = services.env.APP_ORIGIN
    const keyboard = appKeyboard(texts.openShowcase, showcaseAppUrl(origin))
    if (!isStart(message.text)) {
        await services.telegram.sendMessage(token, message.chat.id, texts.onlyInApp, { keyboard })
        return
    }
    await sendWelcome(services.telegram, {
        token,
        chatId: message.chat.id,
        pictureUrl: welcomePictureUrl(origin, "platform"),
        video: welcomeVideo(origin, "platform"),
        html: texts.platformWelcome,
        options: { keyboard },
    })
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
        // Approval cards an admin got from this bot before Zumda Business took them over.
        const callback = update?.callback_query
        if (callback) {
            const origin = new URL(c.req.url).origin
            await handleSafely(() =>
                handleReviewCallback(services, services.env.PLATFORM_BOT_TOKEN, callback, origin),
            )
        }
        return c.json({ ok: true })
    })

    /** The Zumda Business bot: owners, applications, admins' approvals, bots it manages. */
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
            await handleSafely(() => handleBusinessMessage(services, message))
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

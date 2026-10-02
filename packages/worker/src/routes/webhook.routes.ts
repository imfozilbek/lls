import {
    DomainError,
    ForbiddenError,
    Language,
    languageFromTelegram,
    toShopOwnerDTO,
} from "@lls/core"
import { Hono } from "hono"

import { timingSafeEqual } from "../crypto.js"
import { platformAdminIds } from "../env.js"
import {
    formatRate,
    parseCourierReviewCallback,
    parseOrderCallback,
    parseReviewCallback,
} from "../telegram/format.js"
import { TelegramApiError, escapeHtml } from "../telegram/gateway.js"
import { Notifier, onboardingAppUrl, shopAppUrl, showcaseAppUrl } from "../telegram/notifier.js"
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

import { handleCourierBotCallback, handleCourierBotMessage } from "./courier-bot.js"

import type { AppEnv } from "../env.js"
import type { Services } from "../services.js"
import type { Callback, IncomingMessage } from "../telegram/updates.js"
import type { Business, OrderDTO, ShopOwnerDTO } from "@lls/core"

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
        order =
            action.kind === "advance"
                ? await services.useCases.advanceOrder.execute({
                      actorTelegramId: callback.from.id,
                      businessId: business.id,
                      orderId: action.orderId,
                      to: action.to,
                      paidWith: action.paidWith,
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
        const texts = textsFor(languageFromTelegram(callback.from.language_code))
        // Connect the shop bot first: a failed card edit or answer must not skip it.
        await connectOrWarn(services, shop, workerOrigin, callback.from.id)
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

const MARKET_COMMAND = /^\/market(?:@\w+)?\s+([a-z0-9-]{3,40})\s+(off|\d{1,2}(?:[.,]\d{1,2})?)\s*$/i
const BPS_PER_PERCENT = 100

/**
 * Approve: connect the shop bot and tell the owner. If Telegram refuses (network, bad token),
 * the shop is already active, so the admin gets the reason and `/reconnect <slug>` to retry.
 */
async function connectOrWarn(
    services: Services,
    shop: ShopOwnerDTO,
    workerOrigin: string,
    adminChatId: number,
): Promise<boolean> {
    try {
        await new Notifier(services).shopReviewed(shop, workerOrigin)
        return true
    } catch (error) {
        if (!(error instanceof TelegramApiError)) {
            throw error
        }
        const texts = textsFor(await languageOfChat(services, adminChatId))
        const warning = fill(texts.botNotConnected, {
            shop: `<b>${escapeHtml(shop.name)}</b>`,
            reason: escapeHtml(error.description),
            slug: shop.slug,
        })
        await services.telegram.sendMessage(services.env.PLATFORM_BOT_TOKEN, adminChatId, warning)
        return false
    }
}

async function languageOfChat(services: Services, telegramId: number): Promise<Language> {
    const customer = await services.customers.findByTelegramId(telegramId)
    return customer?.language ?? Language.UZ
}

const RECONNECT_COMMAND = /^\/reconnect(?:@\w+)?\s+([a-z0-9-]{3,40})\s*$/i

/** `/reconnect <slug>` from a platform admin: set the shop bot's webhook and menu again. */
async function handleReconnectCommand(
    services: Services,
    message: IncomingMessage,
    workerOrigin: string,
): Promise<void> {
    const from = message.from
    const token = services.env.PLATFORM_BOT_TOKEN
    if (!from || !platformAdminIds(services.env).includes(from.id)) {
        return
    }
    const texts = textsFor(languageFromTelegram(from.language_code))
    const slug = RECONNECT_COMMAND.exec(message.text?.trim() ?? "")?.[1]?.toLowerCase()
    const business = slug ? await services.businesses.findBySlug(slug) : null
    if (!business) {
        await services.telegram.sendMessage(token, message.chat.id, texts.reconnectUsage)
        return
    }
    const name = `<b>${escapeHtml(business.name)}</b>`
    if (!business.isActive()) {
        await services.telegram.sendMessage(
            token,
            message.chat.id,
            fill(texts.shopNotActive, { shop: name }),
        )
        return
    }
    const shop = toShopOwnerDTO(business, services.clock.now())
    if (await connectOrWarn(services, shop, workerOrigin, message.chat.id)) {
        await services.telegram.sendMessage(
            token,
            message.chat.id,
            fill(texts.botConnected, { shop: name }),
        )
    }
}

/** `/market <slug> <percent|off>` from a platform admin: sign or end a showcase deal. */
async function handleMarketCommand(services: Services, message: IncomingMessage): Promise<void> {
    const from = message.from
    const token = services.env.PLATFORM_BOT_TOKEN
    // Everyone else gets no hint that the command exists.
    if (!from || !platformAdminIds(services.env).includes(from.id)) {
        return
    }
    const texts = textsFor(languageFromTelegram(from.language_code))
    const match = MARKET_COMMAND.exec(message.text?.trim() ?? "")
    if (!match?.[1] || !match[2]) {
        await services.telegram.sendMessage(token, message.chat.id, texts.showcaseUsage)
        return
    }
    const off = match[2].toLowerCase() === "off"
    try {
        const shop = await services.useCases.setMarketplaceTerms.execute({
            actorTelegramId: from.id,
            slug: match[1].toLowerCase(),
            commissionBps: off
                ? null
                : Math.round(Number(match[2].replace(",", ".")) * BPS_PER_PERCENT),
        })
        const name = `<b>${escapeHtml(shop.name)}</b>`
        const reply = shop.marketplace
            ? fill(texts.showcaseSet, {
                  shop: name,
                  rate: formatRate(shop.marketplace.commissionBps),
              })
            : fill(texts.showcaseOff, { shop: name })
        await services.telegram.sendMessage(token, message.chat.id, reply)
        await new Notifier(services).showcaseChanged(shop)
    } catch (error) {
        if (!(error instanceof DomainError)) {
            throw error
        }
        await services.telegram.sendMessage(token, message.chat.id, escapeHtml(error.message))
    }
}

/** The LLS bot: welcome with the showcase and onboarding buttons, phones, admin commands. */
async function handlePlatformMessage(
    services: Services,
    message: IncomingMessage,
    workerOrigin: string,
): Promise<void> {
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
    if (message.text?.trim().startsWith("/reconnect")) {
        await handleReconnectCommand(services, message, workerOrigin)
        return
    }
    if (message.text?.trim().startsWith("/market")) {
        await handleMarketCommand(services, message)
        return
    }
    if (isStart(message.text)) {
        const origin = services.env.APP_ORIGIN
        await services.telegram.sendMessage(token, message.chat.id, texts.platformWelcome, {
            keyboard: {
                inline_keyboard: [
                    [{ text: texts.openShowcase, web_app: { url: showcaseAppUrl(origin) } }],
                    [{ text: texts.connectShop, web_app: { url: onboardingAppUrl(origin) } }],
                ],
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
            const origin = new URL(c.req.url).origin
            await handleSafely(() => handlePlatformMessage(services, message, origin))
        }
        if (update?.callback_query) {
            const callback = update.callback_query
            await handleSafely(() =>
                handleReviewCallback(services, callback, new URL(c.req.url).origin),
            )
        }
        return c.json({ ok: true })
    })

    /** The LLS courier bot: invites, phones, and the buttons on order cards of every shop. */
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

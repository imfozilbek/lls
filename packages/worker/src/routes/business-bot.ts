/**
 * The Zumda Biznes bot (webhook `/tg/business`): owners open «Mening bizneslarim» here; platform
 * admins approve applications and run `/reconnect`, `/market`, `/district`, `/network`.
 */
import { DomainError, Language, languageFromTelegram, toShopOwnerDTO } from "@zumda/core"

import { platformAdminIds } from "../env.js"
import { formatRate, parseReviewCallback } from "../telegram/format.js"
import { TelegramApiError, escapeHtml } from "../telegram/gateway.js"
import { Notifier, businessAppUrl } from "../telegram/notifier.js"
import { fill, textsFor } from "../telegram/texts.js"
import { isStart } from "../telegram/updates.js"
import { sendWelcome, welcomePictureUrl } from "../telegram/welcome.js"

import { handleDistrictCommand, handleNetworkCommand } from "./district-commands.js"

import type { Services } from "../services.js"
import type { Callback, IncomingMessage } from "../telegram/updates.js"
import type { ShopOwnerDTO } from "@zumda/core"

/**
 * An admin's «Tasdiqlash / Rad etish» on an application card. `token` is the bot the card came
 * from: Zumda Biznes, or the customers' Zumda bot for cards sent before Zumda Biznes existed.
 */
export async function handleReviewCallback(
    services: Services,
    token: string,
    callback: Callback,
    workerOrigin: string,
): Promise<void> {
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
                `🏪 <b>${escapeHtml(shop.name)}</b>: ${status}`,
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
        await services.telegram.sendMessage(services.env.BUSINESS_BOT_TOKEN, adminChatId, warning)
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
    const token = services.env.BUSINESS_BOT_TOKEN
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
    const token = services.env.BUSINESS_BOT_TOKEN
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

/** Zumda Biznes: the welcome with «Mening bizneslarim», and the admins' commands. */
export async function handleBusinessMessage(
    services: Services,
    message: IncomingMessage,
    workerOrigin: string,
): Promise<void> {
    const from = message.from
    if (!from) {
        return
    }
    const text = message.text?.trim() ?? ""
    if (text.startsWith("/reconnect")) {
        await handleReconnectCommand(services, message, workerOrigin)
        return
    }
    if (text.startsWith("/market")) {
        await handleMarketCommand(services, message)
        return
    }
    if (text.startsWith("/district")) {
        await handleDistrictCommand(services, message)
        return
    }
    if (/^\/network(?:@\w+)?\s*$/.test(text)) {
        await handleNetworkCommand(services, message)
        return
    }
    if (isStart(message.text)) {
        const texts = textsFor(languageFromTelegram(from.language_code))
        const origin = services.env.APP_ORIGIN
        await sendWelcome(services.telegram, {
            token: services.env.BUSINESS_BOT_TOKEN,
            chatId: message.chat.id,
            pictureUrl: welcomePictureUrl(origin, "business"),
            html: texts.businessWelcome,
            options: {
                keyboard: {
                    inline_keyboard: [
                        [{ text: texts.openBusinesses, web_app: { url: businessAppUrl(origin) } }],
                    ],
                },
            },
        })
    }
}

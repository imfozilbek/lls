/**
 * The Zumda Business bot (webhook `/tg/business`): it only notifies. `/start` and any other
 * message open «Mening bizneslarim»; platform admins approve applications with the card's buttons
 * and do everything else in «Platforma» (owner's decision: bots notify, the Mini App acts).
 */
import { ConflictError, DomainError, languageFromTelegram } from "@zumda/core"

import { appKeyboard, businessAppUrl } from "../telegram/app-links.js"
import { parseReviewCallback } from "../telegram/format.js"
import { escapeHtml } from "../telegram/gateway.js"
import { connectReviewedShop, warnBotNotConnected } from "../telegram/shop-connection.js"
import { textsFor } from "../telegram/texts.js"
import { callbackErrorText, isStart } from "../telegram/updates.js"
import { sendWelcome, welcomePictureUrl, welcomeVideo } from "../telegram/welcome.js"

import type { Services } from "../services.js"
import type { Callback, IncomingMessage } from "../telegram/updates.js"

/**
 * An admin's «Tasdiqlash / Rad etish» on an application card. `token` is the bot the card came
 * from: Zumda Business, or the customers' Zumda bot for cards sent before Zumda Business existed.
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
    const texts = textsFor(languageFromTelegram(callback.from.language_code))
    try {
        const shop = await services.useCases.reviewShop.execute({
            actorTelegramId: callback.from.id,
            businessId: review.businessId,
            decision: review.decision,
            // An old card (another admin decided, or «Platforma» did) never changes a decided shop.
            onlyPending: true,
        })
        // Connect the shop bot first: a failed card edit or answer must not skip it.
        const bot = await connectReviewedShop(services, shop, workerOrigin)
        if (!bot.connected) {
            await warnBotNotConnected(services, shop, bot.reason, callback.from.id)
        }
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
        await services.telegram.answerCallback(token, callback.id, reviewRefusal(error, texts))
    }
}

/** What an admin reads when the card's button cannot act: the shop's status now, in Uzbek. */
function reviewRefusal(error: DomainError, texts: ReturnType<typeof textsFor>): string {
    if (error instanceof ConflictError && error.reason === "SHOP_ALREADY_REVIEWED") {
        const status = error.details?.["status"] as keyof typeof texts.shopStatus | undefined
        return status ? texts.shopStatus[status] : texts.callbackOutdated
    }
    return callbackErrorText(error, texts)
}

/** Zumda Business: `/start` gets the welcome; anything else, one line pointing to the app. */
export async function handleBusinessMessage(
    services: Services,
    message: IncomingMessage,
): Promise<void> {
    const from = message.from
    if (!from) {
        return
    }
    const texts = textsFor(languageFromTelegram(from.language_code))
    const keyboard = appKeyboard(
        texts.openBusinesses,
        businessAppUrl(services.env.BUSINESS_APP_ORIGIN),
    )
    const token = services.env.BUSINESS_BOT_TOKEN
    if (!isStart(message.text)) {
        await services.telegram.sendMessage(token, message.chat.id, texts.onlyInApp, { keyboard })
        return
    }
    await sendWelcome(services.telegram, {
        token,
        chatId: message.chat.id,
        pictureUrl: welcomePictureUrl(services.env.APP_ORIGIN, "business"),
        video: welcomeVideo(services.env.APP_ORIGIN, "business"),
        html: texts.businessWelcome,
        options: { keyboard },
    })
}

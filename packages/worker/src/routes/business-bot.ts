/**
 * The Zumda Business bot (webhook `/tg/business`): it only notifies. `/start` and any other
 * message open «Mening bizneslarim» (owner's decision: bots notify, the Mini App acts). The one
 * answer it takes is the owner's phone, with the button of «Raqam so'rash». Platform admins work
 * in Zumda | Platforma; an approval card that reached them here still works.
 */
import { ConflictError, DomainError, languageFromTelegram } from "@zumda/core"

import { appKeyboard, businessAppUrl } from "../telegram/app-links.js"
import { saveOwnPhone } from "../telegram/contacts.js"
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
 * from: Zumda | Platforma; Zumda Business for cards sent before it (or when it could not reach
 * the admin); the customers' Zumda bot for cards sent before Zumda Business existed.
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

/**
 * The owner's own contact from «📱 Raqamimni yuborish»: their phone in Zumda, which a shop
 * without «Mijozlar uchun telefon» shows and calls on (`shopCallPhone`), so it takes orders again.
 */
async function ownerPhone(
    services: Services,
    message: IncomingMessage,
    texts: ReturnType<typeof textsFor>,
): Promise<void> {
    if (await saveOwnPhone(services, message)) {
        await services.telegram.sendMessage(
            services.env.BUSINESS_BOT_TOKEN,
            message.chat.id,
            texts.ownerPhoneSaved,
            { removeKeyboard: true },
        )
    }
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
    if (message.contact) {
        await ownerPhone(services, message, texts)
        return
    }
    const keyboard = appKeyboard(
        texts.openBusinesses,
        businessAppUrl(services.env.BUSINESS_APP_ORIGIN),
    )
    const token = services.env.BUSINESS_BOT_TOKEN
    // «✏️ Boshqa raqam yozaman»: the shop's own number is typed in the app's settings.
    if (message.text === texts.ownerPhoneOther) {
        await services.telegram.sendMessage(token, message.chat.id, texts.ownerPhoneOtherHow, {
            keyboard,
        })
        return
    }
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

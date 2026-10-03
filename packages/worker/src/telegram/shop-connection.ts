import { Language } from "@zumda/core"

import { appKeyboard, platformAppUrl } from "./app-links.js"
import { TelegramApiError, escapeHtml } from "./gateway.js"
import { Notifier } from "./notifier.js"
import { fill, textsFor } from "./texts.js"

import type { Services } from "../services.js"
import type { ShopOwnerDTO } from "@zumda/core"

/** Whether the shop bot answers through Zumda now; if not, Telegram's reason. */
export type BotConnection = { connected: true } | { connected: false; reason: string }

/**
 * After a review (or «Botni qayta ulash»): the owner hears the decision and an approved shop's bot
 * is connected (webhook, menu button). Telegram refusing is not an error of the request: the shop
 * is already approved, the admin sees the reason and connects it again from «Platforma».
 */
export async function connectReviewedShop(
    services: Services,
    shop: ShopOwnerDTO,
    workerOrigin: string,
): Promise<BotConnection> {
    try {
        await new Notifier(services).shopReviewed(shop, workerOrigin)
        return { connected: true }
    } catch (error) {
        if (!(error instanceof TelegramApiError)) {
            throw error
        }
        return { connected: false, reason: error.description }
    }
}

/** The admin approved from the bot: a bot that did not connect is told there, with «Platforma». */
export async function warnBotNotConnected(
    services: Services,
    shop: ShopOwnerDTO,
    reason: string,
    adminChatId: number,
): Promise<void> {
    const customer = await services.customers.findByTelegramId(adminChatId)
    const t = textsFor(customer?.language ?? Language.UZ)
    const warning = fill(t.botNotConnected, {
        shop: `<b>${escapeHtml(shop.name)}</b>`,
        reason: escapeHtml(reason),
    })
    const url = platformAppUrl(services.env.BUSINESS_APP_ORIGIN, { shopId: shop.id })
    await services.telegram.sendMessage(services.env.BUSINESS_BOT_TOKEN, adminChatId, warning, {
        keyboard: appKeyboard(t.openPlatform, url),
    })
}

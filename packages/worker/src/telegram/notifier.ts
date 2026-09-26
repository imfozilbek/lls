import { Language, OrderStatus } from "@lls/core"

import { platformAdminIds } from "../env.js"

import {
    formatNewOrderForOwner,
    formatOrderForOwner,
    formatStatusForCustomer,
    orderKeyboard,
} from "./format.js"
import { escapeHtml } from "./gateway.js"
import { fill, textsFor } from "./texts.js"

import type { Services } from "../services.js"
import type { Business, OrderDTO, ShopOwnerDTO } from "@lls/core"

/** Mini App URL for a shop: the shop bot's menu button and /start button open this. */
export function shopAppUrl(appOrigin: string, slug: string): string {
    return `${appOrigin}/?shop=${encodeURIComponent(slug)}`
}

export function onboardingAppUrl(appOrigin: string): string {
    return `${appOrigin}/?mode=onboarding`
}

/**
 * Sends Telegram messages about orders and shops.
 * Callers run these after the response (waitUntil); failures are logged, never thrown to users.
 */
export class Notifier {
    constructor(private readonly services: Services) {}

    async orderPlaced(business: Business, order: OrderDTO): Promise<void> {
        const token = await this.shopToken(business.id)
        const language = await this.languageOf(business.ownerTelegramId.value)
        const { messageId } = await this.services.telegram.sendMessage(
            token,
            business.ownerTelegramId.value,
            formatNewOrderForOwner(order, language),
            { keyboard: orderKeyboard(order, language) },
        )
        await this.services.orders.setOwnerMessageId(order.id, messageId)
    }

    /** After a status change: refresh the owner's card and tell the other side. */
    async orderChanged(business: Business, order: OrderDTO): Promise<void> {
        const token = await this.shopToken(business.id)
        const ownerId = business.ownerTelegramId.value
        const ownerLanguage = await this.languageOf(ownerId)
        const card = formatOrderForOwner(order, ownerLanguage)
        const keyboard = orderKeyboard(order, ownerLanguage)
        const messageId = await this.services.orders.getOwnerMessageId(order.id)
        if (messageId === null) {
            await this.services.telegram.sendMessage(token, ownerId, card, { keyboard })
        } else {
            await this.services.telegram.editMessage(token, ownerId, messageId, card, { keyboard })
        }

        if (order.status === OrderStatus.CANCELLED && order.cancelledBy === "customer") {
            const text = `${textsFor(ownerLanguage).cancelledByCustomer}: #${order.number}`
            await this.services.telegram.sendMessage(token, ownerId, text)
            return
        }
        await this.notifyCustomer(token, order)
    }

    async shopRegistered(shop: ShopOwnerDTO): Promise<void> {
        const token = this.services.env.PLATFORM_BOT_TOKEN
        const ownerLanguage = await this.languageOf(shop.ownerTelegramId)
        const name = escapeHtml(shop.name)
        await this.services.telegram.sendMessage(
            token,
            shop.ownerTelegramId,
            fill(textsFor(ownerLanguage).applicationReceived, { shop: `<b>${name}</b>` }),
        )
        const summary = [
            `🏪 <b>${name}</b> (${shop.type})`,
            `@${escapeHtml(shop.botUsername)} · ${shop.slug}`,
            `Owner: <a href="tg://user?id=${shop.ownerTelegramId}">${shop.ownerTelegramId}</a>`,
        ].join("\n")
        for (const adminId of platformAdminIds(this.services.env)) {
            await this.services.telegram.sendMessage(token, adminId, summary, {
                keyboard: {
                    inline_keyboard: [
                        [
                            { text: "✅ Approve", callback_data: `r:${shop.id}:approve` },
                            { text: "❌ Reject", callback_data: `r:${shop.id}:reject` },
                        ],
                    ],
                },
            })
        }
    }

    /** Approve: connect the shop bot (webhook + menu button) and send the owner their link. */
    async shopReviewed(shop: ShopOwnerDTO, workerOrigin: string): Promise<void> {
        const platformToken = this.services.env.PLATFORM_BOT_TOKEN
        const texts = textsFor(await this.languageOf(shop.ownerTelegramId))
        const name = `<b>${escapeHtml(shop.name)}</b>`
        if (shop.status !== "active") {
            await this.services.telegram.sendMessage(
                platformToken,
                shop.ownerTelegramId,
                fill(texts.shopRejected, { shop: name }),
            )
            return
        }
        const credentials = await this.services.businesses.getBotCredentials(shop.id)
        if (!credentials) {
            throw new Error(`No bot credentials for shop ${shop.id}`)
        }
        const telegram = this.services.telegram
        const appOrigin = this.services.env.APP_ORIGIN
        await telegram.setWebhook(
            credentials.token,
            `${workerOrigin}/tg/${credentials.botId}`,
            credentials.webhookSecret,
        )
        await telegram.setMenuButton(
            credentials.token,
            texts.openMenu,
            shopAppUrl(appOrigin, shop.slug),
        )
        const link = `https://t.me/${shop.botUsername}`
        await telegram.sendMessage(
            platformToken,
            shop.ownerTelegramId,
            `${fill(texts.shopApproved, { shop: name })}\n${link}`,
        )
    }

    private async notifyCustomer(token: string, order: OrderDTO): Promise<void> {
        const customer = await this.services.customers.findById(order.customerId)
        if (!customer) {
            return
        }
        const text = formatStatusForCustomer(order, customer.language)
        if (text) {
            await this.services.telegram.sendMessage(token, customer.telegramId.value, text)
        }
    }

    private async shopToken(businessId: string): Promise<string> {
        const credentials = await this.services.businesses.getBotCredentials(businessId)
        if (!credentials) {
            throw new Error(`No bot credentials for shop ${businessId}`)
        }
        return credentials.token
    }

    /** Owners and customers get messages in the language they chose in the app. */
    private async languageOf(telegramId: number): Promise<Language> {
        const customer = await this.services.customers.findByTelegramId(telegramId)
        return customer?.language ?? Language.UZ
    }
}

/** Run a notification after the response; log failures instead of breaking the request. */
export function inBackground(
    ctx: { waitUntil(promise: Promise<unknown>): void },
    task: Promise<void>,
): void {
    ctx.waitUntil(
        task.catch((error: unknown) => {
            console.error("Telegram notification failed", error)
        }),
    )
}

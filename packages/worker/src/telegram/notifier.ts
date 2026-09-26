import { Language, OrderStatus } from "@lls/core"

import { platformAdminIds } from "../env.js"

import {
    courierKeyboard,
    formatNewOrderForOwner,
    formatOrderForCourier,
    formatOrderForOwner,
    formatStatusForCustomer,
    orderKeyboard,
} from "./format.js"
import { escapeHtml } from "./gateway.js"
import { fill, textsFor } from "./texts.js"

import type { Reader } from "./format.js"
import type { InlineKeyboard } from "./gateway.js"
import type { Services } from "../services.js"
import type { Business, OrderDTO, ShopOwnerDTO } from "@lls/core"

/** Mini App URL for a shop: the shop bot's menu button and /start button open this. */
export function shopAppUrl(appOrigin: string, slug: string): string {
    return `${appOrigin}/?shop=${encodeURIComponent(slug)}`
}

/** The courier's screen inside the same Mini App. */
export function courierAppUrl(appOrigin: string, slug: string): string {
    return `${shopAppUrl(appOrigin, slug)}&mode=courier`
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
        const ownerId = business.ownerTelegramId.value
        const reader = await this.readerFor(ownerId, business)
        const { messageId } = await this.services.telegram.sendMessage(
            token,
            ownerId,
            formatNewOrderForOwner(order, reader),
            { keyboard: orderKeyboard(order, reader) },
        )
        await this.services.orders.setMessageId(order.id, "owner", messageId)
    }

    /** After a status change: refresh the owner's and the courier's cards, tell the customer. */
    async orderChanged(business: Business, order: OrderDTO): Promise<void> {
        const token = await this.shopToken(business.id)
        const messages = await this.services.orders.getMessageIds(order.id)
        const ownerId = business.ownerTelegramId.value
        const owner = await this.readerFor(ownerId, business)
        await this.upsertCard(token, ownerId, messages.owner, {
            text: formatOrderForOwner(order, owner),
            keyboard: orderKeyboard(order, owner),
        })
        await this.refreshCourierCard(token, business, order, messages.courier)

        if (order.status === OrderStatus.CANCELLED && order.cancelledBy === "customer") {
            const text = `${textsFor(owner.language).cancelledByCustomer}: #${order.number}`
            await this.services.telegram.sendMessage(token, ownerId, text)
            return
        }
        await this.notifyCustomer(token, business, order)
    }

    /** The owner assigned (or reassigned) a courier: send the card, tell the previous one. */
    async courierAssigned(
        business: Business,
        order: OrderDTO,
        previousCourierId: string | undefined,
    ): Promise<void> {
        const token = await this.shopToken(business.id)
        const { courier: oldMessage } = await this.services.orders.getMessageIds(order.id)
        if (previousCourierId && previousCourierId !== order.courierId) {
            const previous = await this.services.couriers.findById(previousCourierId)
            if (previous && oldMessage !== null) {
                const reader = await this.readerFor(previous.telegramId.value, business)
                const text = fill(textsFor(reader.language).courierRemoved, { n: order.number })
                await this.services.telegram.editMessage(
                    token,
                    previous.telegramId.value,
                    oldMessage,
                    text,
                )
            }
        }
        await this.refreshCourierCard(token, business, order, null)
        await this.orderChangedForOwner(token, business, order)
    }

    /** Tells the owner a new courier joined through their invite link. */
    async courierJoined(business: Business, courierName: string): Promise<void> {
        const token = await this.shopToken(business.id)
        const ownerId = business.ownerTelegramId.value
        const { language } = await this.readerFor(ownerId, business)
        const text = fill(textsFor(language).courierJoinedOwner, { name: escapeHtml(courierName) })
        await this.services.telegram.sendMessage(token, ownerId, text)
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
        for (const adminId of platformAdminIds(this.services.env)) {
            const t = textsFor(await this.languageOf(adminId))
            const summary = [
                `${t.newShop}: <b>${name}</b> (${shop.type})`,
                `@${escapeHtml(shop.botUsername)} · ${shop.slug}`,
                `${t.ownerLabel}: <a href="tg://user?id=${shop.ownerTelegramId}">${shop.ownerTelegramId}</a>`,
            ].join("\n")
            await this.services.telegram.sendMessage(token, adminId, summary, {
                keyboard: {
                    inline_keyboard: [
                        [
                            { text: t.approve, callback_data: `r:${shop.id}:approve` },
                            { text: t.reject, callback_data: `r:${shop.id}:reject` },
                        ],
                    ],
                },
            })
        }
    }

    /** Approve: connect the shop bot (webhook + menu button) and send the owner their link. */
    async shopReviewed(shop: ShopOwnerDTO, workerOrigin: string): Promise<void> {
        const platformToken = this.services.env.PLATFORM_BOT_TOKEN
        const texts = textsFor(await this.languageOf(shop.ownerTelegramId), shop.type)
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

    private async orderChangedForOwner(
        token: string,
        business: Business,
        order: OrderDTO,
    ): Promise<void> {
        const { owner: messageId } = await this.services.orders.getMessageIds(order.id)
        const ownerId = business.ownerTelegramId.value
        const owner = await this.readerFor(ownerId, business)
        await this.upsertCard(token, ownerId, messageId, {
            text: formatOrderForOwner(order, owner),
            keyboard: orderKeyboard(order, owner),
        })
    }

    /** Sends or edits the courier's card. A card edit makes no sound, so "ready" also pings. */
    private async refreshCourierCard(
        token: string,
        business: Business,
        order: OrderDTO,
        messageId: number | null,
    ): Promise<void> {
        if (!order.courierId) {
            return
        }
        const courier = await this.services.couriers.findById(order.courierId)
        if (!courier) {
            return
        }
        const chatId = courier.telegramId.value
        const reader = await this.readerFor(chatId, business)
        const sent = await this.upsertCard(token, chatId, messageId, {
            text: formatOrderForCourier(order, reader),
            keyboard: courierKeyboard(order, reader),
        })
        if (sent !== null) {
            await this.services.orders.setMessageId(order.id, "courier", sent)
        }
        if (messageId !== null && order.status === OrderStatus.READY) {
            const ping = fill(textsFor(reader.language).courierReady, { n: order.number })
            await this.services.telegram.sendMessage(token, chatId, ping)
        }
    }

    /** Edits the card if it exists, otherwise sends it. Returns the id of a newly sent card. */
    private async upsertCard(
        token: string,
        chatId: number,
        messageId: number | null,
        card: { text: string; keyboard: InlineKeyboard },
    ): Promise<number | null> {
        const telegram = this.services.telegram
        if (messageId === null) {
            const sent = await telegram.sendMessage(token, chatId, card.text, {
                keyboard: card.keyboard,
            })
            return sent.messageId
        }
        await telegram.editMessage(token, chatId, messageId, card.text, {
            keyboard: card.keyboard,
        })
        return null
    }

    private async notifyCustomer(
        token: string,
        business: Business,
        order: OrderDTO,
    ): Promise<void> {
        const customer = await this.services.customers.findById(order.customerId)
        if (!customer) {
            return
        }
        const text = formatStatusForCustomer(order, {
            language: customer.language,
            type: business.type,
        })
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

    private async readerFor(telegramId: number, business: Business): Promise<Reader> {
        return { language: await this.languageOf(telegramId), type: business.type }
    }

    /** Everyone gets messages in the language they chose in the app (Uzbek by default). */
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

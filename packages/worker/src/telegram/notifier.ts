import { Language, OrderChannel, OrderStatus, toNetworkOrderDTO } from "@zumda/core"

import { alertAdmins, describeError, isRecipientProblem } from "../alerts.js"
import { platformAdminIds } from "../env.js"

import {
    courierKeyboard,
    courierReviewKeyboard,
    formatNetworkOffer,
    formatNewOrderForOwner,
    formatOrderForCourier,
    formatOrderForOwner,
    formatMoney,
    formatRate,
    formatStatusForCustomer,
    networkInviteKeyboard,
    networkOfferKeyboard,
    orderKeyboard,
} from "./format.js"
import { escapeHtml } from "./gateway.js"
import { fill, textsFor } from "./texts.js"

import type { Reader } from "./format.js"
import type { InlineKeyboard, OutgoingFile } from "./gateway.js"
import type { BotTexts } from "./texts.js"
import type { Services } from "../services.js"
import type {
    Business,
    CourierDTO,
    NetworkClaim,
    NetworkRequest,
    OrderDTO,
    OverdueNetworkOrder,
    ShopOwnerDTO,
} from "@zumda/core"

/** Mini App URL for a shop: the shop bot's menu button and /start button open this. */
export function shopAppUrl(appOrigin: string, slug: string): string {
    return `${appOrigin}/?shop=${encodeURIComponent(slug)}`
}

/** The courier's screen across all their shops, opened from the Zumda courier bot. */
export function courierAppUrl(appOrigin: string): string {
    return `${appOrigin}/?mode=courier`
}

/** «Mening bizneslarim»: the owner's businesses, opened from the Zumda Business bot. */
export function businessAppUrl(appOrigin: string): string {
    return `${appOrigin}/?mode=business`
}

/** The Zumda showcase: search across shops, opened from the Zumda bot. */
export function showcaseAppUrl(appOrigin: string): string {
    return `${appOrigin}/?mode=market`
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

    /**
     * Right after checkout: the card and the sum, so the customer can transfer from the chat.
     * Sent on its own: a failed owner card never keeps the customer from paying.
     */
    async askForTransfer(business: Business, order: OrderDTO): Promise<void> {
        // The card this order was shown: the owner may have switched the payment card since.
        const card = order.payment.card
        if (!card) {
            return
        }
        const token = await this.shopToken(business.id)
        await this.tellCustomer(token, business, order, (t, language) =>
            fill(t.payByTransfer, {
                n: order.number,
                sum: `<b>${formatMoney(order.total, language)}</b>`,
                card: card.number.replace(/(\d{4})(?=\d)/g, "$1 "),
                holder: escapeHtml(card.holder),
            }),
        )
    }

    /** «Я перевёл»: the owner's card shows it, and a ping says to check the card. */
    async transferSent(business: Business, order: OrderDTO): Promise<void> {
        const token = await this.shopToken(business.id)
        await this.orderChangedForOwner(token, business, order)
        const ownerId = business.ownerTelegramId.value
        const { language } = await this.readerFor(ownerId, business)
        const text = fill(textsFor(language).transferSentOwner, {
            n: order.number,
            sum: `<b>${formatMoney(order.total, language)}</b>`,
        })
        await this.services.telegram.sendMessage(token, ownerId, text)
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
        await this.refreshCourierCard(business, order, messages.courier)
        if (order.status === OrderStatus.CANCELLED) {
            await this.closeNetworkOffers(business, order)
        }

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
        const courierBot = this.services.env.COURIER_BOT_TOKEN
        const { courier: oldMessage } = await this.services.orders.getMessageIds(order.id)
        if (previousCourierId && previousCourierId !== order.courierId) {
            const previous = await this.services.couriers.findById(previousCourierId)
            if (previous) {
                const chatId = previous.telegramId.value
                const reader = await this.readerFor(chatId, business)
                const text = fill(textsFor(reader.language).courierRemoved, {
                    n: order.number,
                    shop: escapeHtml(business.name),
                })
                // The old card turns into the note; if it was not stored yet, a new message.
                if (oldMessage === null) {
                    await this.services.telegram.sendMessage(courierBot, chatId, text)
                } else {
                    await this.services.telegram.editMessage(courierBot, chatId, oldMessage, text)
                }
            }
        }
        await this.refreshCourierCard(business, order, null)
        await this.orderChangedForOwner(token, business, order)
        // The shop's own courier took it: the network's offers are no longer open.
        await this.closeNetworkOffers(business, order)
    }

    /** Only the owner's card changed (the order went to the network by hand). */
    async ownerCardChanged(business: Business, order: OrderDTO): Promise<void> {
        await this.orderChangedForOwner(await this.shopToken(business.id), business, order)
    }

    /**
     * The shop asked the district network: «Новый заказ рядом» to its free network couriers,
     * and the owner learns that the network is looking. The owner's card is refreshed by the
     * caller (it may already show it).
     */
    async networkRequested(request: NetworkRequest): Promise<void> {
        const { business, order, district } = request
        const token = await this.shopToken(business.id)
        const ownerId = business.ownerTelegramId.value
        const t = textsFor(await this.languageOf(ownerId), business.type)
        await this.services.telegram.sendMessage(
            token,
            ownerId,
            fill(t.networkRequestedOwner, { n: order.number }),
        )
        const people = await this.services.useCases.freeNetworkCouriers.execute({
            districtId: district.id,
        })
        await this.offerToNetwork(business, order.id, people)
    }

    /** Offers waiting orders to someone who just went on shift or joined the network. */
    async offerWaitingOrders(telegramId: number): Promise<void> {
        const waiting = await this.services.useCases.listNetworkOrders.execute({ telegramId })
        for (const offer of waiting) {
            const business = await this.services.businesses.findById(offer.businessId)
            if (business) {
                await this.offerToNetwork(business, offer.id, [telegramId])
            }
        }
    }

    /** «Новый заказ рядом» with «Беру»; nobody gets the same order twice. */
    private async offerToNetwork(
        business: Business,
        orderId: string,
        people: readonly number[],
    ): Promise<void> {
        const order = await this.services.orders.findById(orderId)
        if (!order?.isWaitingForNetwork()) {
            return
        }
        const told = await this.services.networkOffers.recipients(orderId)
        const offer = toNetworkOrderDTO(order, business)
        for (const telegramId of people.filter((id) => !told.has(id))) {
            const language = await this.languageOf(telegramId)
            const { messageId } = await this.services.telegram.sendMessage(
                this.services.env.COURIER_BOT_TOKEN,
                telegramId,
                formatNetworkOffer(offer, language),
                { keyboard: networkOfferKeyboard(orderId, textsFor(language)) },
            )
            await this.services.networkOffers.save(
                orderId,
                { telegramId, messageId },
                this.services.clock.now(),
            )
        }
    }

    /**
     * Someone pressed «Беру» first: their offer says the order is theirs and the full card
     * follows; everyone else's offer says it is taken; the owner learns who brings it.
     */
    async networkClaimed(claim: NetworkClaim): Promise<void> {
        const { business, order } = claim
        await this.closeNetworkOffers(business, order, claim.courierTelegramId)
        await this.refreshCourierCard(business, order, null)
        const token = await this.shopToken(business.id)
        const ownerId = business.ownerTelegramId.value
        const t = textsFor(await this.languageOf(ownerId), business.type)
        await this.orderChangedForOwner(token, business, order)
        await this.services.telegram.sendMessage(
            token,
            ownerId,
            fill(t.networkClaimedOwner, {
                n: order.number,
                name: escapeHtml(order.courierName ?? ""),
            }),
        )
    }

    /** Edits the open offers of an order once, then forgets them. */
    private async closeNetworkOffers(
        business: Business,
        order: OrderDTO,
        winner?: number,
    ): Promise<void> {
        const offers = await this.services.networkOffers.list(order.id)
        if (offers.length === 0) {
            return
        }
        await this.services.networkOffers.clear(order.id)
        const shop = escapeHtml(business.name)
        for (const offer of offers) {
            const t = textsFor(await this.languageOf(offer.telegramId))
            const text = fill(offer.telegramId === winner ? t.networkYours : t.networkTaken, {
                n: order.number,
                shop,
            })
            await this.services.telegram.editMessage(
                this.services.env.COURIER_BOT_TOKEN,
                offer.telegramId,
                offer.messageId,
                text,
            )
        }
    }

    /** Nobody took these network orders in time: each shop and the admins hear it once. */
    async networkOverdue(late: readonly OverdueNetworkOrder[]): Promise<void> {
        for (const { order, business, district } of late) {
            const token = await this.shopToken(business.id)
            const ownerId = business.ownerTelegramId.value
            const minutes = district.waitMinutes
            const t = textsFor(await this.languageOf(ownerId), business.type)
            await this.services.telegram.sendMessage(
                token,
                ownerId,
                fill(t.networkOverdueOwner, { n: order.number, min: minutes }),
            )
            for (const adminId of platformAdminIds(this.services.env)) {
                const admin = textsFor(await this.languageOf(adminId))
                await this.services.telegram.sendMessage(
                    this.services.env.BUSINESS_BOT_TOKEN,
                    adminId,
                    fill(admin.networkOverdueAdmin, {
                        shop: escapeHtml(business.name),
                        n: order.number,
                        min: minutes,
                        district: escapeHtml(district.name),
                    }),
                )
            }
        }
    }

    /** A transfer for a cancelled order arrived (owed back), or the money went back. */
    async paymentChanged(business: Business, order: OrderDTO): Promise<void> {
        const token = await this.shopToken(business.id)
        const messages = await this.services.orders.getMessageIds(order.id)
        await this.orderChangedForOwner(token, business, order)
        await this.refreshCourierCard(business, order, messages.courier)
    }

    /** A file for the owner in the shop bot's chat: the CSV report or the QR poster. */
    async fileToOwner(business: Business, file: OutgoingFile, caption: string): Promise<void> {
        const token = await this.shopToken(business.id)
        await this.services.telegram.sendDocument(
            token,
            business.ownerTelegramId.value,
            file,
            caption,
        )
    }

    /** Someone accepted the shop's invite: the owner approves or declines, in the shop bot. */
    async courierJoined(business: Business, courier: CourierDTO): Promise<void> {
        const token = await this.shopToken(business.id)
        const ownerId = business.ownerTelegramId.value
        const t = textsFor(await this.languageOf(ownerId), business.type)
        const text = fill(t.courierJoinedOwner, { name: escapeHtml(courier.name) })
        await this.services.telegram.sendMessage(token, ownerId, text, {
            keyboard: courierReviewKeyboard(courier.id, t),
        })
    }

    /** The owner approved or declined: the courier hears it in the Zumda courier bot. */
    async courierReviewed(
        business: Business,
        courier: CourierDTO,
        telegramId: number,
    ): Promise<void> {
        const t = textsFor(await this.languageOf(telegramId), business.type)
        const shop = `<b>${escapeHtml(business.name)}</b>`
        const approved = courier.isActive
        await this.services.telegram.sendMessage(
            this.services.env.COURIER_BOT_TOKEN,
            telegramId,
            fill(approved ? t.courierApproved : t.courierDeclined, { shop }),
            approved
                ? {
                      keyboard: {
                          inline_keyboard: [
                              [
                                  {
                                      text: t.myDeliveries,
                                      web_app: {
                                          url: courierAppUrl(this.services.env.COURIER_APP_ORIGIN),
                                      },
                                  },
                              ],
                          ],
                      },
                  }
                : {},
        )
        if (approved && (await this.services.useCases.offerNetwork.execute({ telegramId }))) {
            await this.services.telegram.sendMessage(
                this.services.env.COURIER_BOT_TOKEN,
                telegramId,
                t.networkInvite,
                { keyboard: networkInviteKeyboard(t) },
            )
        }
    }

    /** The owner removed a courier: they stay a courier of their other shops. */
    async courierRemovedFromShop(business: Business, telegramId: number): Promise<void> {
        const t = textsFor(await this.languageOf(telegramId), business.type)
        await this.services.telegram.sendMessage(
            this.services.env.COURIER_BOT_TOKEN,
            telegramId,
            fill(t.courierRemovedFromShop, { shop: `<b>${escapeHtml(business.name)}</b>` }),
        )
    }

    /** Tells the owner (in Zumda Business, where they applied) that the showcase deal changed. */
    async showcaseChanged(shop: ShopOwnerDTO): Promise<void> {
        const t = textsFor(await this.languageOf(shop.ownerTelegramId))
        const name = `<b>${escapeHtml(shop.name)}</b>`
        const text = shop.marketplace
            ? fill(t.showcaseJoined, {
                  shop: name,
                  rate: formatRate(shop.marketplace.commissionBps),
              })
            : fill(t.showcaseLeft, { shop: name })
        await this.services.telegram.sendMessage(
            this.services.env.BUSINESS_BOT_TOKEN,
            shop.ownerTelegramId,
            text,
        )
    }

    async shopRegistered(shop: ShopOwnerDTO): Promise<void> {
        const token = this.services.env.BUSINESS_BOT_TOKEN
        const ownerLanguage = await this.languageOf(shop.ownerTelegramId)
        const name = escapeHtml(shop.name)
        await this.services.telegram.sendMessage(
            token,
            shop.ownerTelegramId,
            fill(textsFor(ownerLanguage).applicationReceived, { shop: `<b>${name}</b>` }),
        )
        const owner = await this.services.customers.findByTelegramId(shop.ownerTelegramId)
        const ownerName = escapeHtml(owner?.name ?? String(shop.ownerTelegramId))
        for (const adminId of platformAdminIds(this.services.env)) {
            const t = textsFor(await this.languageOf(adminId))
            const summary = [
                `${t.newShop}: <b>${name}</b> (${t.shopTypes[shop.type]})`,
                `@${escapeHtml(shop.botUsername)} · ${shop.slug}`,
                `${t.ownerLabel}: <a href="tg://user?id=${shop.ownerTelegramId}">${ownerName}</a>`,
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

    /** Zumda's picture on the shop bot: the shop's logo (or name) with the Zumda mark. */
    async shopBotPhoto(shopId: string, jpeg: Uint8Array): Promise<void> {
        const credentials = await this.services.businesses.getBotCredentials(shopId)
        if (!credentials) {
            throw new Error(`No bot credentials for shop ${shopId}`)
        }
        await this.services.telegram.setProfilePhoto(credentials.token, jpeg)
    }

    /** The shop bot's description and profile line, always with «Zumda asosida ishlaydi». */
    async shopBotDescriptions(shop: ShopOwnerDTO): Promise<void> {
        const credentials = await this.services.businesses.getBotCredentials(shop.id)
        if (!credentials) {
            throw new Error(`No bot credentials for shop ${shop.id}`)
        }
        const texts = textsFor(Language.UZ, shop.type)
        await this.services.telegram.setDescriptions(credentials.token, {
            description: fitShopName(texts.shopBotDescription, shop.name, BOT_DESCRIPTION_MAX, {
                openMenu: texts.openMenu,
            }),
            shortDescription: fitShopName(
                texts.shopBotShortDescription,
                shop.name,
                BOT_SHORT_DESCRIPTION_MAX,
            ),
        })
    }

    /** The shop bot answers through this Worker: its webhook and the menu button to the app. */
    async connectShopBot(shop: ShopOwnerDTO, workerOrigin: string): Promise<void> {
        const credentials = await this.services.businesses.getBotCredentials(shop.id)
        if (!credentials) {
            throw new Error(`No bot credentials for shop ${shop.id}`)
        }
        const texts = textsFor(await this.languageOf(shop.ownerTelegramId), shop.type)
        await this.services.telegram.setWebhook(
            credentials.token,
            `${workerOrigin}/tg/${credentials.botId}`,
            credentials.webhookSecret,
        )
        await this.services.telegram.setMenuButton(
            credentials.token,
            texts.openMenu,
            shopAppUrl(this.services.env.APP_ORIGIN, shop.slug),
        )
    }

    /** The owner created a bot from Zumda Business: back to the application, no token to copy. */
    async managedBotCreated(ownerTelegramId: number, botUsername: string): Promise<void> {
        const texts = textsFor(await this.languageOf(ownerTelegramId))
        await this.services.telegram.sendMessage(
            this.services.env.BUSINESS_BOT_TOKEN,
            ownerTelegramId,
            fill(texts.managedBotCreated, { bot: `@${escapeHtml(botUsername)}` }),
            {
                keyboard: {
                    inline_keyboard: [
                        [
                            {
                                text: texts.continueSetup,
                                web_app: {
                                    url: businessAppUrl(this.services.env.BUSINESS_APP_ORIGIN),
                                },
                            },
                        ],
                    ],
                },
            },
        )
    }

    /** Someone else owns a shop's managed bot now: the admins decide, nothing moves silently. */
    async managedBotOwnerChanged(shop: ShopOwnerDTO, newOwnerTelegramId: number): Promise<void> {
        const token = this.services.env.BUSINESS_BOT_TOKEN
        for (const adminId of platformAdminIds(this.services.env)) {
            const t = textsFor(await this.languageOf(adminId))
            await this.services.telegram.sendMessage(
                token,
                adminId,
                fill(t.managedBotOwnerChanged, {
                    shop: `<b>${escapeHtml(shop.name)}</b>`,
                    bot: `@${escapeHtml(shop.botUsername)}`,
                    owner: `<a href="tg://user?id=${newOwnerTelegramId}">${newOwnerTelegramId}</a>`,
                }),
            )
        }
    }

    /** Approve: connect the shop bot (webhook + menu button) and send the owner their link. */
    async shopReviewed(shop: ShopOwnerDTO, workerOrigin: string): Promise<void> {
        const businessToken = this.services.env.BUSINESS_BOT_TOKEN
        const texts = textsFor(await this.languageOf(shop.ownerTelegramId), shop.type)
        const name = `<b>${escapeHtml(shop.name)}</b>`
        if (shop.status !== "active") {
            await this.services.telegram.sendMessage(
                businessToken,
                shop.ownerTelegramId,
                fill(texts.shopRejected, { shop: name }),
            )
            return
        }
        await this.connectShopBot(shop, workerOrigin)
        const link = `https://t.me/${shop.botUsername}`
        await this.services.telegram.sendMessage(
            businessToken,
            shop.ownerTelegramId,
            `${fill(texts.shopApproved, { shop: name })}\n${link}`,
        )
        // The shop already works: a description Telegram refused only reaches the admins.
        await this.shopBotDescriptions(shop).catch((error: unknown) =>
            alertAdmins(this.services, "notification_failed", error),
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

    /**
     * Sends or edits the courier's card in the Zumda courier bot. A card edit makes no sound, so
     * "ready" also pings.
     */
    private async refreshCourierCard(
        business: Business,
        order: OrderDTO,
        messageId: number | null,
    ): Promise<void> {
        const token = this.services.env.COURIER_BOT_TOKEN
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
            text: formatOrderForCourier(order, reader, business.name),
            keyboard: courierKeyboard(order, reader),
        })
        if (sent !== null) {
            await this.services.orders.setMessageId(order.id, "courier", sent)
        }
        if (messageId !== null && order.status === OrderStatus.READY) {
            const ping = fill(textsFor(reader.language).courierReady, {
                n: order.number,
                shop: escapeHtml(business.name),
            })
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
        await this.tellCustomer(token, business, order, (_t, language) =>
            formatStatusForCustomer(order, { language, type: business.type }),
        )
    }

    /** Writes the customer in their language; a showcase customer hears from the Zumda bot. */
    private async tellCustomer(
        token: string,
        business: Business,
        order: OrderDTO,
        compose: (t: BotTexts, language: Language) => string | null,
    ): Promise<void> {
        const customer = await this.services.customers.findById(order.customerId)
        if (!customer) {
            return
        }
        const text = compose(textsFor(customer.language, business.type), customer.language)
        if (!text) {
            return
        }
        // A showcase customer started only the Zumda bot, so the Zumda bot writes, naming the shop.
        if (order.channel === OrderChannel.MARKETPLACE) {
            const shop = `<b>${escapeHtml(business.name)}</b>`
            await this.services.telegram.sendMessage(
                this.services.env.PLATFORM_BOT_TOKEN,
                customer.telegramId.value,
                `${shop}\n${text}`,
            )
            return
        }
        await this.services.telegram.sendMessage(token, customer.telegramId.value, text)
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

/**
 * Run a notification after the response; a failure never breaks the request. It is logged, and
 * the admins hear about it unless the recipient simply blocked the bot.
 */
/** Bot API limits for `setMyDescription` and `setMyShortDescription`. */
const BOT_DESCRIPTION_MAX = 512
const BOT_SHORT_DESCRIPTION_MAX = 120
const ELLIPSIS = "…"

/** Fills `{shop}`, shortening a long shop name so the text stays within Telegram's limit. */
function fitShopName(
    template: string,
    shopName: string,
    max: number,
    values: Record<string, string> = {},
): string {
    const rest = fill(template, { ...values, shop: "" }).length
    const room = max - rest
    const shop = shopName.length <= room ? shopName : `${shopName.slice(0, room - 1)}${ELLIPSIS}`
    return fill(template, { ...values, shop })
}

export function inBackground(
    ctx: { waitUntil(promise: Promise<unknown>): void },
    services: Services,
    task: Promise<void>,
): void {
    ctx.waitUntil(
        task.catch(async (error: unknown) => {
            console.error("Telegram notification failed", describeError(error))
            if (!isRecipientProblem(error)) {
                await alertAdmins(services, "notification_failed", error)
            }
        }),
    )
}

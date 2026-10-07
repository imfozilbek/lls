import {
    DEFAULT_LANGUAGE,
    LANGUAGES,
    Language,
    OrderChannel,
    OrderStatus,
    OwnerChat,
    PaymentMethod,
    PaymentStatus,
    cardSystemOf,
    toNetworkOrderDTO,
} from "@zumda/core"

import { alertAdmins, describeError, isRecipientProblem } from "../alerts.js"
import { platformAdminIds } from "../env.js"

import {
    appButton,
    appKeyboard,
    businessAppUrl,
    courierAppUrl,
    platformAppUrl,
    shopAppUrl,
    shopBotStartUrl,
    showcaseOrderUrl,
    withAppButton,
} from "./app-links.js"
import {
    cardTail,
    confirmPaidKeyboard,
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
    receiptWarnings,
} from "./format.js"
import { TelegramApiError, escapeHtml } from "./gateway.js"
import { refreshManagedBotToken } from "./managed-token.js"
import { fill, textsFor } from "./texts.js"

import type { PlatformTarget } from "./app-links.js"
import type { Reader } from "./format.js"
import type { InlineButton, InlineKeyboard, OutgoingFile } from "./gateway.js"
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
    TripResult,
} from "@zumda/core"

/**
 * Sends Telegram messages about orders and shops.
 * Callers run these after the response (waitUntil); failures are logged, never thrown to users.
 */
/** Telegram's answers when the card to edit was deleted or can no longer be edited. */
function cardIsGone(error: unknown): boolean {
    return (
        error instanceof TelegramApiError &&
        /message to edit not found|message can't be edited/.test(error.description)
    )
}

/** The card already says exactly this: nothing to do. */
function unchanged(error: unknown): boolean {
    return (
        error instanceof TelegramApiError && error.description.includes("message is not modified")
    )
}

/** Runs every step even if one fails; the first failure is reported after all of them ran. */
export async function everyOne(steps: readonly (() => Promise<void>)[]): Promise<void> {
    const failures: unknown[] = []
    for (const step of steps) {
        try {
            await step()
        } catch (error) {
            failures.push(error)
        }
    }
    if (failures.length > 0) {
        throw failures[0]
    }
}

/**
 * Where a message for the owner arrived: the shop's own bot, Zumda | Business (the shop's bot
 * may not write to the owner: never started, or blocked), or nowhere (both refused).
 */
export type OwnerDelivery = "shop" | "business" | "none"

/** What a message through Zumda | Business carries instead: the note on top, its buttons. */
interface OwnerNote {
    text: string
    keyboard: InlineKeyboard
}

export class Notifier {
    constructor(private readonly services: Services) {}

    async orderPlaced(business: Business, order: OrderDTO): Promise<void> {
        const token = await this.shopToken(business.id)
        const ownerId = business.ownerTelegramId.value
        const reader = await this.readerFor(ownerId, business)
        const text = formatNewOrderForOwner(order, reader)
        await this.reachOwner(
            business,
            async () => {
                const { messageId } = await this.services.telegram.sendMessage(
                    token,
                    ownerId,
                    text,
                    { keyboard: this.ownerKeyboard(business, order, reader) },
                )
                await this.services.orders.setMessageId(order.id, "owner", messageId)
            },
            (note) => this.noteToOwner(business, note, text),
        )
    }

    /**
     * Right after checkout: the card and the sum, so the customer can transfer from the chat, or
     * the sum to have ready for the courier. Sent on its own: a failed owner card never keeps the
     * customer from paying.
     */
    async askForTransfer(business: Business, order: OrderDTO): Promise<void> {
        if (order.payment.method === PaymentMethod.CASH) {
            const token = await this.shopToken(business.id)
            await this.tellCustomer(token, business, order, (t, language) =>
                fill(t.payByCash, {
                    n: order.number,
                    sum: `<b>${formatMoney(order.total, language)}</b>`,
                }),
            )
            return
        }
        // The card this order was shown: the owner may have switched the payment card since.
        const card = order.payment.card
        if (!card) {
            return
        }
        const token = await this.shopToken(business.id)
        const system = cardSystemOf(card.number)
        await this.tellCustomer(token, business, order, (t, language) =>
            fill(t.payByTransfer, {
                n: order.number,
                sum: `<b>${formatMoney(order.total, language)}</b>`,
                system: system ? `${t.cardSystems[system]} ` : "",
                card: card.number.replace(/(\d{4})(?=\d)/g, "$1 "),
                holder: escapeHtml(card.holder),
            }),
        )
    }

    /** «Я перевёл»: the owner's card shows it, and a ping says to check the card. */
    /**
     * «Я перевёл» with the screenshot: the owner gets the picture itself in the shop bot, with
     * what to check (the sum, the card) and any warning, and the two answers.
     */
    async transferSent(
        business: Business,
        order: OrderDTO,
        receipt: { bytes: Uint8Array; contentType: string },
    ): Promise<void> {
        const token = await this.shopToken(business.id)
        await this.orderChangedForOwner(token, business, order)
        const ownerId = business.ownerTelegramId.value
        const reader = await this.readerFor(ownerId, business)
        const t = textsFor(reader.language, business.type)
        const sum = formatMoney(order.total, reader.language)
        const caption = [
            fill(t.receiptCaption, {
                n: order.number,
                sum: `<b>${sum}</b>`,
                name: escapeHtml(order.customerName),
                card: cardTail(order),
            }),
            ...receiptWarnings(order, t),
        ].join("\n")
        const url = shopAppUrl(this.services.env.APP_ORIGIN, business.slug.value, order.id)
        const options = {
            keyboard: withAppButton(
                confirmPaidKeyboard(order, t, sum),
                appButton(t.openOrder, url),
            ),
        }
        const file = {
            name: `chek-${order.number}.${receipt.contentType.split("/")[1] ?? "jpg"}`,
            contentType: receipt.contentType,
            bytes: receipt.bytes,
        }
        await this.reachOwner(
            business,
            async () => {
                try {
                    await this.services.telegram.sendPhotoFile(
                        token,
                        ownerId,
                        file,
                        caption,
                        options,
                    )
                } catch (error) {
                    // Telegram refused the picture itself: the owner still hears it, the picture
                    // is in the app.
                    if (!(error instanceof TelegramApiError) || isRecipientProblem(error)) {
                        throw error
                    }
                    await this.services.telegram.sendMessage(token, ownerId, caption, options)
                }
            },
            (note) => this.noteToOwner(business, note, caption),
        )
    }

    /** «Pul keldi» pressed in the chat: ask once, with the sum and the card to look at. */
    async askPaymentConfirm(business: Business, order: OrderDTO, reminder = false): Promise<void> {
        const token = await this.shopToken(business.id)
        const ownerId = business.ownerTelegramId.value
        const reader = await this.readerFor(ownerId, business)
        const t = textsFor(reader.language, business.type)
        const sum = formatMoney(order.total, reader.language)
        const lines = [
            ...(reminder ? [fill(t.transferReminder, { n: order.number })] : []),
            fill(t.confirmPaidQuestion, {
                n: order.number,
                sum: `<b>${sum}</b>`,
                card: cardTail(order),
            }),
            ...(order.payment.status === PaymentStatus.UNPAID ? [t.confirmPaidNoReceipt] : []),
            ...receiptWarnings(order, t),
        ]
        await this.textToOwner(
            business,
            token,
            lines.join("\n"),
            confirmPaidKeyboard(order, t, sum),
        )
    }

    /** «Pul kelmadi»: the owner's card shows it, the customer is asked to check and send again. */
    async transferRejected(business: Business, order: OrderDTO): Promise<void> {
        const token = await this.shopToken(business.id)
        await everyOne([
            (): Promise<void> => this.orderChangedForOwner(token, business, order),
            (): Promise<void> =>
                this.tellCustomer(token, business, order, (t) =>
                    fill(t.transferRejectedCustomer, { n: order.number }),
                ),
        ])
    }

    /** After a status change: refresh the owner's and the courier's cards, tell the customer. */
    async orderChanged(business: Business, order: OrderDTO): Promise<void> {
        const token = await this.shopToken(business.id)
        const messages = await this.services.orders.getMessageIds(order.id)
        const ownerId = business.ownerTelegramId.value
        const owner = await this.readerFor(ownerId, business)
        const cancelled = order.status === OrderStatus.CANCELLED
        // Each one hears it even if another's message fails (a deleted card, a blocked bot).
        await everyOne([
            (): Promise<void> => this.orderChangedForOwner(token, business, order),
            (): Promise<void> => this.refreshCourierCard(business, order, messages.courier),
            // Cancelled, or moved on without the network (the owner took it himself): «Беру» goes.
            (): Promise<void> =>
                cancelled || !order.waitingForNetwork
                    ? this.closeNetworkOffers(business, order)
                    : Promise.resolve(),
            (): Promise<void> =>
                cancelled && order.cancelledBy === "customer"
                    ? this.toOwner(
                          token,
                          business,
                          order,
                          `${textsFor(owner.language).cancelledByCustomer}: #${order.number}`,
                      )
                    : this.notifyCustomer(token, business, order),
        ])
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

    /**
     * The owner gave several orders one way to one courier: each order's card as for a single
     * assignment, then one message with the order of the stops and the button to the trip.
     */
    async tripAssigned(
        business: Business,
        trip: TripResult,
        previousCouriers: ReadonlyMap<string, string | undefined>,
    ): Promise<void> {
        // Each order on its own: one blocked customer must not keep the rest of the trip silent.
        const cards = trip.orders.map(
            (order): (() => Promise<void>) =>
                (): Promise<void> =>
                    this.courierAssigned(business, order, previousCouriers.get(order.id)),
        )
        await everyOne([...cards, (): Promise<void> => this.tripMessage(business, trip)])
    }

    private async tripMessage(business: Business, trip: TripResult): Promise<void> {
        const chatId = trip.courierTelegramId
        const t = textsFor((await this.readerFor(chatId, business)).language)
        const numbers = new Map(trip.orders.map((o) => [o.id, o.number]))
        const stops = trip.trip.stops.map((id) => `#${numbers.get(id) ?? "?"}`).join(" → ")
        await this.services.telegram.sendMessage(
            this.services.env.COURIER_BOT_TOKEN,
            chatId,
            fill(t.tripAssigned, {
                shop: escapeHtml(business.name),
                count: trip.trip.stops.length,
                stops,
            }),
            { keyboard: { inline_keyboard: [[this.courierAppButton(t)]] } },
        )
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
        await this.toOwner(
            token,
            business,
            order,
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
        const sent: { telegramId: number; messageId: number }[] = []
        try {
            for (const telegramId of people.filter((id) => !told.has(id))) {
                const language = await this.languageOf(telegramId)
                const { messageId } = await this.services.telegram.sendMessage(
                    this.services.env.COURIER_BOT_TOKEN,
                    telegramId,
                    formatNetworkOffer(offer, language),
                    {
                        keyboard: withAppButton(
                            networkOfferKeyboard(orderId, textsFor(language)),
                            this.courierAppButton(textsFor(language)),
                        ),
                    },
                )
                sent.push({ telegramId, messageId })
            }
        } finally {
            // Whatever went out is kept, even if a later message failed: nobody gets it twice.
            await this.services.networkOffers.saveMany(orderId, sent, this.services.clock.now())
        }
    }

    /**
     * Someone pressed «Беру» first: their offer says the order is theirs and the full card
     * follows; everyone else's offer says it is taken; the owner learns who brings it.
     */
    async networkClaimed(claim: NetworkClaim): Promise<void> {
        const { business, order } = claim
        const token = await this.shopToken(business.id)
        const ownerId = business.ownerTelegramId.value
        const t = textsFor(await this.languageOf(ownerId), business.type)
        await everyOne([
            (): Promise<void> => this.closeNetworkOffers(business, order, claim.courierTelegramId),
            (): Promise<void> => this.refreshCourierCard(business, order, null),
            (): Promise<void> => this.orderChangedForOwner(token, business, order),
            (): Promise<void> =>
                this.toOwner(
                    token,
                    business,
                    order,
                    fill(t.networkClaimedOwner, {
                        n: order.number,
                        name: escapeHtml(order.courierName ?? ""),
                    }),
                ),
        ])
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
        // Each offer on its own: one deleted message must not leave the others saying «Беру».
        await everyOne(
            offers.map((offer) => async (): Promise<void> => {
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
            }),
        )
    }

    /** Nobody took these network orders in time: each shop and the admins hear it once. */
    async networkOverdue(late: readonly OverdueNetworkOrder[]): Promise<void> {
        for (const { order, business, district } of late) {
            const token = await this.shopToken(business.id)
            const ownerId = business.ownerTelegramId.value
            const minutes = district.waitMinutes
            const t = textsFor(await this.languageOf(ownerId), business.type)
            await this.toOwner(
                token,
                business,
                order,
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
                    { keyboard: this.platformKeyboard(admin, "districts") },
                )
            }
        }
    }

    /** A transfer for a cancelled order arrived (owed back), or the money went back. */
    async paymentChanged(business: Business, order: OrderDTO): Promise<void> {
        const token = await this.shopToken(business.id)
        const messages = await this.services.orders.getMessageIds(order.id)
        await everyOne([
            (): Promise<void> => this.orderChangedForOwner(token, business, order),
            (): Promise<void> => this.refreshCourierCard(business, order, messages.courier),
        ])
    }

    /**
     * A file for the owner in the shop bot's chat: the CSV report or the QR poster. Through
     * Zumda | Business when the shop's bot may not write to the owner yet.
     */
    async fileToOwner(
        business: Business,
        file: OutgoingFile,
        caption: string,
    ): Promise<OwnerDelivery> {
        const token = await this.shopToken(business.id)
        const ownerId = business.ownerTelegramId.value
        return this.reachOwner(
            business,
            () => this.services.telegram.sendDocument(token, ownerId, file, caption),
            (note) =>
                this.services.telegram.sendDocument(
                    this.services.env.BUSINESS_BOT_TOKEN,
                    ownerId,
                    file,
                    `${note.text}\n\n${caption}`,
                    { keyboard: note.keyboard },
                ),
        )
    }

    /**
     * May the shop's bot write to its owner? "typing…" for a moment, nothing in the chat:
     * Telegram refuses it to someone who never pressed Start in the bot. What it learns is kept.
     */
    async checkOwnerChat(business: Business): Promise<OwnerChat> {
        const token = await this.shopToken(business.id)
        const now = this.services.clock.now()
        try {
            await this.services.telegram.sendTyping(token, business.ownerTelegramId.value)
        } catch (error) {
            if (!isRecipientProblem(error)) {
                throw error
            }
            if (business.ownerChatClosed(now)) {
                await this.services.businesses.saveOwnerChat(business)
            }
            return OwnerChat.CLOSED
        }
        if (business.ownerChatOpened(now)) {
            await this.services.businesses.saveOwnerChat(business)
        }
        return OwnerChat.OPEN
    }

    /** Someone accepted the shop's invite: the owner approves or declines, in the shop bot. */
    async courierJoined(business: Business, courier: CourierDTO): Promise<void> {
        const token = await this.shopToken(business.id)
        const ownerId = business.ownerTelegramId.value
        const t = textsFor(await this.languageOf(ownerId), business.type)
        const text = fill(t.courierJoinedOwner, { name: escapeHtml(courier.name) })
        await this.textToOwner(
            business,
            token,
            text,
            withAppButton(
                courierReviewKeyboard(courier.id, t),
                appButton(
                    t.openInApp,
                    shopAppUrl(this.services.env.APP_ORIGIN, business.slug.value),
                ),
            ),
        )
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
                ? { keyboard: { inline_keyboard: [[this.courierAppButton(t, t.myDeliveries)]] } }
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
            { keyboard: { inline_keyboard: [[this.courierAppButton(t, t.myDeliveries)]] } },
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
            { keyboard: this.businessesKeyboard(t) },
        )
    }

    /**
     * A card was added or customers now pay another one: the owner hears it from Zumda | Business,
     * never from the shop bot, so a card changed by someone else does not go unnoticed.
     */
    async cardChanged(
        business: Business,
        change: { kind: "added" | "payment"; number: string },
    ): Promise<void> {
        const ownerId = business.ownerTelegramId.value
        const t = textsFor(await this.languageOf(ownerId))
        const text = fill(change.kind === "added" ? t.cardAddedOwner : t.paymentCardOwner, {
            shop: `<b>${escapeHtml(business.name)}</b>`,
            card: `•••• ${change.number.slice(-4)}`,
        })
        await this.services.telegram.sendMessage(
            this.services.env.BUSINESS_BOT_TOKEN,
            ownerId,
            text,
            { keyboard: this.businessesKeyboard(t) },
        )
    }

    async shopRegistered(shop: ShopOwnerDTO): Promise<void> {
        const token = this.services.env.BUSINESS_BOT_TOKEN
        const ownerLanguage = await this.languageOf(shop.ownerTelegramId)
        const name = escapeHtml(shop.name)
        const ownerTexts = textsFor(ownerLanguage)
        await this.services.telegram.sendMessage(
            token,
            shop.ownerTelegramId,
            fill(ownerTexts.applicationReceived, { shop: `<b>${name}</b>` }),
            { keyboard: this.businessesKeyboard(ownerTexts) },
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
                        [
                            appButton(
                                t.openApplication,
                                platformAppUrl(this.services.env.BUSINESS_APP_ORIGIN, {
                                    shopId: shop.id,
                                }),
                            ),
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
        if (shop.managedBot) {
            // The owner may have changed the token in @BotFather without Telegram telling us.
            const current = await this.services.businesses.getBotCredentials(shop.id)
            if (current) {
                await refreshManagedBotToken(this.services, current.botId)
            }
        }
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
        // Only `/start`: a command the owner once set in @BotFather would lead nowhere.
        await this.services.telegram.setCommands(credentials.token, [
            { command: "start", description: texts.startCommand },
        ])
    }

    /**
     * Right after the application: the shop's bot answers («Tez orada ochiladi»), opens the
     * storefront and carries Zumda's description. Approval connects it again.
     */
    async connectApplied(shop: ShopOwnerDTO, workerOrigin: string): Promise<void> {
        await this.connectShopBot(shop, workerOrigin)
        await this.shopBotDescriptions(shop)
    }

    /** The owner created a bot from Zumda Business: back to the application, no token to copy. */
    async managedBotCreated(ownerTelegramId: number, botUsername: string): Promise<void> {
        const texts = textsFor(await this.languageOf(ownerTelegramId))
        await this.services.telegram.sendMessage(
            this.services.env.BUSINESS_BOT_TOKEN,
            ownerTelegramId,
            fill(texts.managedBotCreated, { bot: `@${escapeHtml(botUsername)}` }),
            {
                keyboard: appKeyboard(
                    texts.continueSetup,
                    businessAppUrl(this.services.env.BUSINESS_APP_ORIGIN),
                ),
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
                { keyboard: this.platformKeyboard(t, { shopId: shop.id }) },
            )
        }
    }

    /** Approve: connect the shop bot (webhook + menu button) and send the owner their link. */
    async shopReviewed(shop: ShopOwnerDTO, workerOrigin: string): Promise<void> {
        const businessToken = this.services.env.BUSINESS_BOT_TOKEN
        const texts = textsFor(await this.languageOf(shop.ownerTelegramId), shop.type)
        const name = `<b>${escapeHtml(shop.name)}</b>`
        if (shop.status !== "active" && !shop.rejection) {
            // A live shop turned off: not a rejected application.
            await this.services.telegram.sendMessage(
                businessToken,
                shop.ownerTelegramId,
                fill(texts.shopDisabled, { shop: name }),
                { keyboard: this.businessesKeyboard(texts) },
            )
            return
        }
        if (shop.status !== "active") {
            const reason = shop.rejection?.reason
            const lines = [
                fill(texts.shopRejected, { shop: name }),
                reason ? fill(texts.shopRejectedReason, { reason: escapeHtml(reason) }) : null,
                shop.rejection ? texts.shopRejectedNext : null,
            ]
            await this.services.telegram.sendMessage(
                businessToken,
                shop.ownerTelegramId,
                lines.filter((line) => line !== null).join("\n"),
                { keyboard: this.businessesKeyboard(texts) },
            )
            return
        }
        await this.connectShopBot(shop, workerOrigin)
        const link = `https://t.me/${shop.botUsername}`
        await this.services.telegram.sendMessage(
            businessToken,
            shop.ownerTelegramId,
            [
                `${fill(texts.shopApproved, { shop: name })}\n${link}`,
                shop.paymentMethods.length > 0 ? null : `\n${texts.shopApprovedNeedsCard}`,
            ]
                .filter((line) => line !== null)
                .join(""),
            { keyboard: this.businessesKeyboard(texts) },
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
        const text = formatOrderForOwner(order, owner)
        await this.reachOwner(
            business,
            async () => {
                const sent = await this.upsertCard(token, ownerId, messageId, {
                    text,
                    keyboard: this.ownerKeyboard(business, order, owner),
                })
                if (sent !== null) {
                    await this.services.orders.setMessageId(order.id, "owner", sent)
                }
            },
            (note) => this.noteToOwner(business, note, text),
        )
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
            keyboard: withAppButton(
                courierKeyboard(order, reader),
                this.courierAppButton(textsFor(reader.language)),
            ),
        })
        if (sent !== null) {
            await this.services.orders.setMessageId(order.id, "courier", sent)
        }
        if (messageId !== null && order.status === OrderStatus.READY) {
            const ping = fill(textsFor(reader.language).courierReady, {
                n: order.number,
                shop: escapeHtml(business.name),
            })
            await this.services.telegram.sendMessage(token, chatId, ping, {
                keyboard: { inline_keyboard: [[this.courierAppButton(textsFor(reader.language))]] },
            })
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
        if (messageId !== null) {
            try {
                await telegram.editMessage(token, chatId, messageId, card.text, {
                    keyboard: card.keyboard,
                })
                return null
            } catch (error) {
                if (unchanged(error)) {
                    return null
                }
                if (!cardIsGone(error)) {
                    throw error
                }
                // The person deleted the card: a fresh one carries the order on.
            }
        }
        const sent = await telegram.sendMessage(token, chatId, card.text, {
            keyboard: card.keyboard,
        })
        return sent.messageId
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
        const t = textsFor(customer.language, business.type)
        const origin = this.services.env.APP_ORIGIN
        const slug = business.slug.value
        // A showcase customer started only the Zumda bot, so the Zumda bot writes, naming the shop.
        if (order.channel === OrderChannel.MARKETPLACE) {
            const shop = `<b>${escapeHtml(business.name)}</b>`
            await this.services.telegram.sendMessage(
                this.services.env.PLATFORM_BOT_TOKEN,
                customer.telegramId.value,
                `${shop}\n${text}`,
                { keyboard: appKeyboard(t.openOrder, showcaseOrderUrl(origin, slug, order.id)) },
            )
            return
        }
        await this.services.telegram.sendMessage(token, customer.telegramId.value, text, {
            keyboard: appKeyboard(t.openOrder, shopAppUrl(origin, slug, order.id)),
        })
    }

    /** The owner's order card: the next step and cancel, then the order in the app. */
    private ownerKeyboard(business: Business, order: OrderDTO, reader: Reader): InlineKeyboard {
        const t = textsFor(reader.language, reader.type)
        const url = shopAppUrl(this.services.env.APP_ORIGIN, business.slug.value, order.id)
        return withAppButton(orderKeyboard(order, reader), appButton(t.openOrder, url))
    }

    /** A line to the owner about an order, from the shop bot, with the order in the app. */
    private async toOwner(
        token: string,
        business: Business,
        order: OrderDTO,
        text: string,
    ): Promise<void> {
        const ownerId = business.ownerTelegramId.value
        const t = textsFor(await this.languageOf(ownerId), business.type)
        const url = shopAppUrl(this.services.env.APP_ORIGIN, business.slug.value, order.id)
        await this.textToOwner(business, token, text, appKeyboard(t.openOrder, url))
    }

    /** A text for the owner from the shop's bot, or through Zumda | Business with the note. */
    private async textToOwner(
        business: Business,
        token: string,
        text: string,
        keyboard: InlineKeyboard,
    ): Promise<OwnerDelivery> {
        return this.reachOwner(
            business,
            async () => {
                await this.services.telegram.sendMessage(
                    token,
                    business.ownerTelegramId.value,
                    text,
                    { keyboard },
                )
            },
            (note) => this.noteToOwner(business, note, text),
        )
    }

    /**
     * The shop's bot first. Telegram lets a bot write first only to someone who pressed Start in
     * it, and a bot made with «Bot yaratish» was never opened: then the same goes through
     * Zumda | Business, where the owner applied, with the note to press Start. Its buttons are
     * links only: a press on an action button would reach the wrong bot. What Zumda learns about
     * the owner's chat is written only when it changes.
     */
    private async reachOwner(
        business: Business,
        viaShopBot: () => Promise<void>,
        viaBusinessBot: (note: OwnerNote) => Promise<unknown>,
    ): Promise<OwnerDelivery> {
        const now = this.services.clock.now()
        try {
            await viaShopBot()
        } catch (error) {
            if (!isRecipientProblem(error)) {
                throw error
            }
            if (business.ownerChatClosed(now)) {
                await this.services.businesses.saveOwnerChat(business)
            }
            try {
                await viaBusinessBot(await this.ownerNote(business))
                return "business"
            } catch (fallback) {
                if (isRecipientProblem(fallback)) {
                    return "none"
                }
                throw fallback
            }
        }
        if (business.ownerChatOpened(now)) {
            await this.services.businesses.saveOwnerChat(business)
        }
        return "shop"
    }

    private async ownerNote(business: Business): Promise<OwnerNote> {
        const t = textsFor(await this.languageOf(business.ownerTelegramId.value), business.type)
        const bot = `@${business.bot.username}`
        return {
            text: fill(t.ownerBotClosed, { bot: escapeHtml(bot) }),
            keyboard: {
                inline_keyboard: [
                    [
                        {
                            text: fill(t.openShopBot, { bot }),
                            url: shopBotStartUrl(business.bot.username),
                        },
                    ],
                    [
                        appButton(
                            t.openBusinesses,
                            businessAppUrl(this.services.env.BUSINESS_APP_ORIGIN),
                        ),
                    ],
                ],
            },
        }
    }

    private async noteToOwner(business: Business, note: OwnerNote, text: string): Promise<void> {
        await this.services.telegram.sendMessage(
            this.services.env.BUSINESS_BOT_TOKEN,
            business.ownerTelegramId.value,
            `${note.text}\n\n${text}`,
            { keyboard: note.keyboard },
        )
    }

    private courierAppButton(t: BotTexts, label = t.openInApp): InlineButton {
        return appButton(label, courierAppUrl(this.services.env.COURIER_APP_ORIGIN))
    }

    private businessesKeyboard(t: BotTexts): InlineKeyboard {
        return appKeyboard(t.openBusinesses, businessAppUrl(this.services.env.BUSINESS_APP_ORIGIN))
    }

    private platformKeyboard(t: BotTexts, target: PlatformTarget): InlineKeyboard {
        return appKeyboard(
            t.openPlatform,
            platformAppUrl(this.services.env.BUSINESS_APP_ORIGIN, target),
        )
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
        // One language in the product (Uzbek): no read per message until there is a choice.
        if (LANGUAGES.length === 1) {
            return DEFAULT_LANGUAGE
        }
        const customer = await this.services.customers.findByTelegramId(telegramId)
        return customer?.language ?? DEFAULT_LANGUAGE
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

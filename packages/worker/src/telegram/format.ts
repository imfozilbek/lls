import {
    OrderChannel,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Unit,
    formatPhone,
    isWeightUnit,
    mapUrl,
} from "@zumda/core"

import { escapeHtml } from "./gateway.js"
import { fill, textsFor } from "./texts.js"

import type { InlineButton, InlineKeyboard } from "./gateway.js"
import type { BotTexts } from "./texts.js"
import type { BusinessType, Language, NetworkOrderDTO, OrderDTO, OrderItemDTO } from "@zumda/core"

/** Who reads a message: their language and the kind of shop the order is from. */
export interface Reader {
    language: Language
    type: BusinessType
}

const GRAMS_PER_KG = 1000
const METERS_PER_KM = 1000

/** 70000 → "70 000 so'm". */
export function formatMoney(amount: number, language: Language): string {
    const grouped = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
    return `${grouped} ${textsFor(language).currency}`
}

/**
 * "× 2" for pieces, "× 1,5 kg" for kilograms, "× 300 g" for goods priced per 100 g or per gram
 * (quantities of weight are grams), "× 12 m²" for everything else that has a word.
 */
function quantityLabel(item: OrderItemDTO, t: BotTexts): string {
    if (item.unit === Unit.KG || (isWeightUnit(item.unit) && item.quantity >= GRAMS_PER_KG)) {
        const kg = String(item.quantity / GRAMS_PER_KG).replace(".", ",")
        return `× ${kg} ${t.kg}`
    }
    const word = t.units[item.unit]
    return word ? `× ${item.quantity} ${word}` : `× ${item.quantity}`
}

/** «Latte (0,4 l · Karamel sirop)»: the name with the variant and add-ons picked. */
function itemName(item: OrderItemDTO): string {
    const name = escapeHtml(item.name)
    return item.options ? `${name} (${escapeHtml(item.options.label)})` : name
}

/** «Latte (0,4 l · Karamel sirop) × 2», plain text: a cell of the owner's CSV. */
export function plainItem(item: OrderItemDTO, t: BotTexts): string {
    const name = item.options ? `${item.name} (${item.options.label})` : item.name
    return `${name} ${quantityLabel(item, t)}`
}

/** Lines a card lists before «… va yana N ta»: a message is at most 4096 characters. */
const MAX_CARD_ITEMS = 20

function itemLines(order: OrderDTO, t: BotTexts, language: Language): string[] {
    const shown = order.items
        .slice(0, MAX_CARD_ITEMS)
        .map(
            (item) =>
                `${itemName(item)} ${quantityLabel(item, t)}: ${formatMoney(item.total, language)}`,
        )
    const hidden = order.items.length - shown.length
    return hidden > 0 ? [...shown, fill(t.moreItems, { n: hidden })] : shown
}

function addressLines(order: OrderDTO, t: BotTexts): string[] {
    const phone = order.customerPhone ? `, ${formatPhone(order.customerPhone)}` : ""
    const landmark = order.landmark ? ` (${t.landmark}: ${escapeHtml(order.landmark)})` : ""
    const lines = [
        `👤 ${escapeHtml(order.customerName)}${phone}`,
        `📍 ${escapeHtml(order.address)}${landmark}`,
    ]
    if (order.location) {
        lines.push(`🗺 <a href="${mapUrl(order.location)}">${t.map}</a>`)
    }
    if (order.comment) {
        lines.push(`💬 ${escapeHtml(order.comment)}`)
    }
    return lines
}

/**
 * One line about the money of an order: a transfer to the shop's card before the shop starts, or
 * cash the courier takes at the door and hands to the shop.
 */
export function paymentLine(order: OrderDTO, t: BotTexts): string {
    const p = t.payment
    if (order.payment.method === PaymentMethod.CASH) {
        if (order.payment.status !== PaymentStatus.PAID) {
            return p.cashUnpaid
        }
        return order.payment.withCourier ? p.cashWithCourier : p.cashReceived
    }
    switch (order.payment.status) {
        case PaymentStatus.UNPAID:
            return p.unpaid
        case PaymentStatus.AWAITING:
            return p.sent
        case PaymentStatus.PAID:
            return p.paid
        case PaymentStatus.REFUND_DUE:
            return p.refundDue
        case PaymentStatus.REFUNDED:
            return p.refunded
    }
}

/** The owner's order card: items, totals, customer, address, courier, current status. */
export function formatOrderForOwner(order: OrderDTO, reader: Reader): string {
    const { language } = reader
    const t = textsFor(language, reader.type)
    const lines = [`<b>${t.order} #${order.number}</b>`, "", ...itemLines(order, t, language)]
    const delivery = order.deliveryFee === 0 ? t.free : formatMoney(order.deliveryFee, language)
    lines.push(`${t.delivery}: ${delivery}`)
    if (order.depositTotal > 0) {
        lines.push(`${t.deposit}: ${formatMoney(order.depositTotal, language)}`)
    }
    lines.push(`<b>${t.total}: ${formatMoney(order.total, language)}</b>`)
    lines.push(paymentLine(order, t))
    if (order.bottlesReturned > 0) {
        lines.push(fill(t.bottlesBack, { n: order.bottlesReturned }))
    }
    lines.push("", ...addressLines(order, t))
    if (order.waitingForNetwork) {
        lines.push(t.networkSearching)
    } else if (order.courierName && order.viaNetwork) {
        lines.push(fill(t.networkCourier, { name: escapeHtml(order.courierName) }))
    } else if (order.courierName) {
        lines.push(`🚚 ${t.courier}: ${escapeHtml(order.courierName)}`)
    }
    lines.push("", `${t.status}: <b>${t.statusNames[order.status]}</b>`)
    if (order.channel === OrderChannel.MARKETPLACE) {
        const sum = formatMoney(order.commission, language)
        lines.push(fill(t.showcaseOrder, { rate: formatRate(order.commissionBps), sum }))
    }
    if (order.cancelReason) {
        lines.push(`${t.reason}: ${escapeHtml(order.cancelReason)}`)
    }
    return lines.join("\n")
}

const BPS_PER_PERCENT = 100

/** 500 bps → "5", 250 bps → "2,5" (Uzbek and Russian use a decimal comma). */
export function formatRate(bps: number): string {
    return String(bps / BPS_PER_PERCENT).replace(".", ",")
}

export function formatNewOrderForOwner(order: OrderDTO, reader: Reader): string {
    return `${textsFor(reader.language).newOrder}\n\n${formatOrderForOwner(order, reader)}`
}

/**
 * The courier's card in the Zumda courier bot: which shop, where to go, whom to call, how many
 * bottles to take, and the money: a transfer was paid before the shop started (take nothing),
 * cash is taken at the door. A courier may work for several shops, so the shop comes first.
 */
export function formatOrderForCourier(order: OrderDTO, reader: Reader, shopName: string): string {
    const { language } = reader
    const t = textsFor(language, reader.type)
    const lines = [
        `<b>${t.courierCard} · ${escapeHtml(shopName)} · ${t.order} #${order.number}</b>`,
        "",
        ...itemLines(order, t, language),
        "",
        courierMoneyLine(order, t, language),
    ]
    if (order.bottlesReturned > 0) {
        lines.push(fill(t.bottlesToCollect, { n: order.bottlesReturned }))
    }
    lines.push("", ...addressLines(order, t))
    lines.push("", `${t.status}: <b>${t.statusNames[order.status]}</b>`)
    if (order.status === OrderStatus.ACCEPTED || order.status === OrderStatus.PREPARING) {
        lines.push(t.courierWait)
    }
    return lines.join("\n")
}

function courierMoneyLine(order: OrderDTO, t: BotTexts, language: Language): string {
    if (order.payment.method === PaymentMethod.CASH) {
        return order.payment.status === PaymentStatus.PAID
            ? paymentLine(order, t)
            : `<b>${fill(t.collectCash, { sum: formatMoney(order.total, language) })}</b>`
    }
    return order.payment.status === PaymentStatus.PAID ? t.nothingToCollect : paymentLine(order, t)
}

export function formatStatusForCustomer(order: OrderDTO, reader: Reader): string | null {
    const t = textsFor(reader.language, reader.type)
    const template =
        order.status === OrderStatus.PICKED_UP && order.courierName
            ? t.courierOnTheWay
            : t.customerStatus[order.status]
    if (!template) {
        return null
    }
    const text = fill(template, { n: order.number, courier: escapeHtml(order.courierName ?? "") })
    const reason = order.cancelReason ? `\n${t.reason}: ${escapeHtml(order.cancelReason)}` : ""
    return text + reason
}

// Callback data (≤ 64 bytes): "a:<orderId>:<status>" advance, "x:<orderId>" cancel,
// "p:<orderId>" «Деньги пришли, принять» (asks first), "pc:<orderId>" yes, the money is here,
// "pn:<orderId>" «Pul kelmadi».
export type OrderCallback =
    | { kind: "advance"; orderId: string; to: OrderStatus }
    | { kind: "cancel"; orderId: string }
    | { kind: "askPaid"; orderId: string }
    | { kind: "paid"; orderId: string }
    | { kind: "notPaid"; orderId: string }

const SIMPLE_CALLBACKS: Record<string, "cancel" | "askPaid" | "paid" | "notPaid"> = {
    x: "cancel",
    p: "askPaid",
    pc: "paid",
    pn: "notPaid",
}

const ORDER_STATUS_VALUES = new Set<string>(Object.values(OrderStatus))

export function parseOrderCallback(data: string): OrderCallback | null {
    const [kind, orderId, status, extra] = data.split(":")
    if (!orderId || extra !== undefined) {
        return null
    }
    const simple = kind === undefined ? undefined : SIMPLE_CALLBACKS[kind]
    if (simple && status === undefined) {
        return { kind: simple, orderId }
    }
    if (kind !== "a" || !status || !ORDER_STATUS_VALUES.has(status)) {
        return null
    }
    return { kind: "advance", orderId, to: status as OrderStatus }
}

/**
 * Owner: the next step + cancel, or no buttons for a finished order. A new transfer order waits
 * for the money: its step is «Деньги пришли, принять». A cash order is accepted at once.
 */
export function orderKeyboard(order: OrderDTO, reader: Reader): InlineKeyboard {
    const t = textsFor(reader.language, reader.type)
    const next = order.nextStatus
    if (!next) {
        return { inline_keyboard: [] }
    }
    const waitsForMoney =
        next === OrderStatus.ACCEPTED &&
        !isPaid(order) &&
        order.payment.method !== PaymentMethod.CASH
    const step: InlineButton = waitsForMoney
        ? { text: t.paidAccept, callback_data: `p:${order.id}` }
        : { text: t.actions[next] ?? next, callback_data: `a:${order.id}:${next}` }
    return { inline_keyboard: [[step], [{ text: t.cancel, callback_data: `x:${order.id}` }]] }
}

/** «Pul keldi»: the owner answers after looking at the bank app, never by reflex. */
export function confirmPaidKeyboard(order: OrderDTO, t: BotTexts, sum: string): InlineKeyboard {
    const rows: InlineButton[][] = [
        [{ text: fill(t.confirmPaidYes, { sum }), callback_data: `pc:${order.id}` }],
    ]
    if (order.payment.status === PaymentStatus.AWAITING) {
        rows.push([{ text: t.confirmPaidNo, callback_data: `pn:${order.id}` }])
    }
    return { inline_keyboard: rows }
}

/** The receipt's warnings for the owner: the same picture again, earlier transfers not found. */
export function receiptWarnings(order: OrderDTO, t: BotTexts): string[] {
    const receipt = order.payment.receipt
    const lines: string[] = []
    if (receipt?.reusedFrom !== undefined) {
        lines.push(
            receipt.reusedFrom > 0
                ? fill(t.receiptReusedHere, { n: receipt.reusedFrom })
                : t.receiptReusedElsewhere,
        )
    }
    const rejected = (receipt?.customerRejections ?? 0) + order.payment.rejections
    if (rejected > 0) {
        lines.push(fill(t.customerRejected, { count: rejected }))
    }
    return lines
}

/** "•••• 9012": the card the money should be on. */
export function cardTail(order: OrderDTO): string {
    const number = order.payment.card?.number
    return number ? `•••• ${number.slice(-4)}` : ""
}

function isPaid(order: OrderDTO): boolean {
    return order.payment.status === PaymentStatus.PAID
}

/** Courier: "Picked up" once the order is ready, then "Delivered". Nothing before or after. */
export function courierKeyboard(order: OrderDTO, reader: Reader): InlineKeyboard {
    const t = textsFor(reader.language, reader.type)
    const next =
        order.status === OrderStatus.READY || order.status === OrderStatus.PICKED_UP
            ? order.nextStatus
            : null
    if (!next) {
        return { inline_keyboard: [] }
    }
    const cash =
        next === OrderStatus.DELIVERED &&
        order.payment.method === PaymentMethod.CASH &&
        order.payment.status !== PaymentStatus.PAID
    const text = cash ? t.cashDelivered : (t.courierActions[next] ?? next)
    return { inline_keyboard: [[{ text, callback_data: `a:${order.id}:${next}` }]] }
}

// Platform admin review: "r:<businessId>:approve" / "r:<businessId>:reject".
export function parseReviewCallback(
    data: string,
): { businessId: string; decision: "approve" | "reject" } | null {
    const [kind, businessId, decision] = data.split(":")
    if (kind !== "r" || !businessId || (decision !== "approve" && decision !== "reject")) {
        return null
    }
    return { businessId, decision }
}

/** The owner approves or declines someone who accepted the invite: "k:<courierId>:approve". */
export function courierReviewKeyboard(courierId: string, t: BotTexts): InlineKeyboard {
    return {
        inline_keyboard: [
            [
                { text: t.approveCourier, callback_data: `k:${courierId}:approve` },
                { text: t.declineCourier, callback_data: `k:${courierId}:decline` },
            ],
        ],
    }
}

export function parseCourierReviewCallback(
    data: string,
): { courierId: string; approve: boolean } | null {
    const [kind, courierId, decision] = data.split(":")
    if (kind !== "k" || !courierId || (decision !== "approve" && decision !== "decline")) {
        return null
    }
    return { courierId, approve: decision === "approve" }
}

/** Invite payload of `/start c_<code>`, or null for a plain /start. */
export function parseCourierInvite(text: string | undefined): string | null {
    const match = /^\/start\s+c_([A-Za-z0-9_-]{8,40})\s*$/.exec(text?.trim() ?? "")
    return match?.[1] ?? null
}

/**
 * «Новый заказ рядом» for a network courier: the shop, what to take, how far. Nothing about the
 * customer until someone presses «Беру».
 */
export function formatNetworkOffer(offer: NetworkOrderDTO, language: Language): string {
    const t = textsFor(language)
    const shop = offer.shopAddress
        ? `🏪 <b>${escapeHtml(offer.shopName)}</b>, ${escapeHtml(offer.shopAddress)}`
        : `🏪 <b>${escapeHtml(offer.shopName)}</b>`
    const lines = [`<b>${t.networkNew}</b> · #${offer.number}`, shop]
    lines.push(fill(t.networkItems, { n: offer.itemsCount }))
    lines.push(t.nothingToCollect)
    if (offer.bottlesReturned > 0) {
        lines.push(fill(t.bottlesToCollect, { n: offer.bottlesReturned }))
    }
    if (offer.distanceMeters !== undefined) {
        const km = (offer.distanceMeters / METERS_PER_KM).toFixed(1).replace(".", ",")
        lines.push(fill(t.networkDistance, { km }))
    }
    return lines.join("\n")
}

/** «Беру» under a network offer: "n:<orderId>". */
export function networkOfferKeyboard(orderId: string, t: BotTexts): InlineKeyboard {
    return { inline_keyboard: [[{ text: t.takeOrder, callback_data: `n:${orderId}` }]] }
}

/** The one-time offer to join the district network: "net:join" / "net:skip". */
export function networkInviteKeyboard(t: BotTexts): InlineKeyboard {
    return {
        inline_keyboard: [
            [
                { text: t.joinNetwork, callback_data: "net:join" },
                { text: t.skipNetwork, callback_data: "net:skip" },
            ],
        ],
    }
}

export type NetworkCallback =
    { kind: "claim"; orderId: string } | { kind: "join" } | { kind: "skip" }

export function parseNetworkCallback(data: string): NetworkCallback | null {
    const [kind, value] = data.split(":")
    if (kind === "n" && value) {
        return { kind: "claim", orderId: value }
    }
    if (kind === "net" && (value === "join" || value === "skip")) {
        return { kind: value }
    }
    return null
}

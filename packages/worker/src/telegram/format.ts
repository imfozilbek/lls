import { OrderChannel, OrderStatus, PaymentStatus, Unit, formatPhone, mapUrl } from "@zumda/core"

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

/** "× 2" for pieces, "× 1,5 kg" for weight items (quantity is in grams). */
function quantityLabel(item: OrderItemDTO, t: BotTexts): string {
    if (item.unit !== Unit.KG) {
        return `× ${item.quantity}`
    }
    const kg = String(item.quantity / GRAMS_PER_KG).replace(".", ",")
    return `× ${kg} ${t.kg}`
}

function itemLines(order: OrderDTO, t: BotTexts, language: Language): string[] {
    return order.items.map(
        (item) =>
            `${escapeHtml(item.name)} ${quantityLabel(item, t)} — ${formatMoney(item.total, language)}`,
    )
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

/** One line about the money of an order: paid to the shop's card before the shop starts. */
export function paymentLine(order: OrderDTO, t: BotTexts): string {
    const p = t.payment
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
 * bottles to take. The customer paid before the shop started: the courier takes no money.
 * A courier may work for several shops, so the shop comes first.
 */
export function formatOrderForCourier(order: OrderDTO, reader: Reader, shopName: string): string {
    const { language } = reader
    const t = textsFor(language, reader.type)
    const lines = [
        `<b>${t.courierCard} · ${escapeHtml(shopName)} · ${t.order} #${order.number}</b>`,
        "",
        ...itemLines(order, t, language),
        "",
        order.payment.status === PaymentStatus.PAID ? t.nothingToCollect : paymentLine(order, t),
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
// "p:<orderId>" «Деньги пришли — принять».
export type OrderCallback =
    | { kind: "advance"; orderId: string; to: OrderStatus }
    | { kind: "cancel"; orderId: string }
    | { kind: "paid"; orderId: string }

const ORDER_STATUS_VALUES = new Set<string>(Object.values(OrderStatus))

export function parseOrderCallback(data: string): OrderCallback | null {
    const [kind, orderId, status, extra] = data.split(":")
    if (!orderId || extra !== undefined) {
        return null
    }
    if (kind === "x" && status === undefined) {
        return { kind: "cancel", orderId }
    }
    if (kind === "p" && status === undefined) {
        return { kind: "paid", orderId }
    }
    if (kind !== "a" || !status || !ORDER_STATUS_VALUES.has(status)) {
        return null
    }
    return { kind: "advance", orderId, to: status as OrderStatus }
}

/**
 * Owner: the next step + cancel, or no buttons for a finished order. A new order waits for the
 * transfer: its step is «Деньги пришли — принять».
 */
export function orderKeyboard(order: OrderDTO, reader: Reader): InlineKeyboard {
    const t = textsFor(reader.language, reader.type)
    const next = order.nextStatus
    if (!next) {
        return { inline_keyboard: [] }
    }
    const waitsForMoney = next === OrderStatus.ACCEPTED && !isPaid(order)
    const step: InlineButton = waitsForMoney
        ? { text: t.paidAccept, callback_data: `p:${order.id}` }
        : { text: t.actions[next] ?? next, callback_data: `a:${order.id}:${next}` }
    return { inline_keyboard: [[step], [{ text: t.cancel, callback_data: `x:${order.id}` }]] }
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
    const text = t.courierActions[next] ?? next
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

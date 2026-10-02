import {
    OrderChannel,
    OrderStatus,
    PAID_WITH,
    PaidWith,
    PaymentMethod,
    PaymentStatus,
    Unit,
    formatPhone,
    mapUrl,
} from "@lls/core"

import { escapeHtml } from "./gateway.js"
import { fill, textsFor } from "./texts.js"

import type { InlineButton, InlineKeyboard } from "./gateway.js"
import type { BotTexts } from "./texts.js"
import type { BusinessType, Language, OrderDTO, OrderItemDTO } from "@lls/core"

/** Who reads a message: their language and the kind of shop the order is from. */
export interface Reader {
    language: Language
    type: BusinessType
}

const GRAMS_PER_KG = 1000

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

/** One line about the money of an order. The owner also sees which courier holds the cash. */
export function paymentLine(order: OrderDTO, t: BotTexts, forOwner = false): string {
    const { payment } = order
    const p = t.payment
    switch (payment.status) {
        case PaymentStatus.AWAITING:
            return p.transferAwaited
        case PaymentStatus.REFUND_DUE:
            return p.refundDue
        case PaymentStatus.REFUNDED:
            return p.refunded
        case PaymentStatus.UNPAID:
            return order.status === OrderStatus.DELIVERED ? p.debt : p.cashDue
        case PaymentStatus.PAID: {
            if (payment.method === PaymentMethod.CARD_TRANSFER) {
                return p.paidCard
            }
            const courier =
                forOwner && payment.cashCourierId && order.courierName
                    ? ` · ${fill(t.withCourier, { name: escapeHtml(order.courierName) })}`
                    : ""
            return p.paidCash + courier
        }
    }
}

/** What the courier takes at the door: the total in cash, or nothing. */
function collectLine(order: OrderDTO, t: BotTexts, language: Language): string {
    if (order.payment.status === PaymentStatus.PAID) {
        return t.nothingToCollect
    }
    if (order.payment.status === PaymentStatus.AWAITING) {
        return t.collectTransfer
    }
    return fill(t.collect, { sum: `<b>${formatMoney(order.total, language)}</b>` })
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
    lines.push(paymentLine(order, t, true))
    if (order.bottlesReturned > 0) {
        lines.push(fill(t.bottlesBack, { n: order.bottlesReturned }))
    }
    lines.push("", ...addressLines(order, t))
    if (order.courierName) {
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
 * The courier's card in the LLS courier bot: which shop, where to go, whom to call, how much cash
 * and how many bottles to take. A courier may work for several shops, so the shop comes first.
 */
export function formatOrderForCourier(order: OrderDTO, reader: Reader, shopName: string): string {
    const { language } = reader
    const t = textsFor(language, reader.type)
    const lines = [
        `<b>${t.courierCard} · ${escapeHtml(shopName)} · ${t.order} #${order.number}</b>`,
        "",
        ...itemLines(order, t, language),
        "",
        collectLine(order, t, language),
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

// Callback data (≤ 64 bytes): "a:<orderId>:<status>[:<paidWith>]" advance, "x:<orderId>" cancel.
export type OrderCallback =
    | { kind: "advance"; orderId: string; to: OrderStatus; paidWith?: PaidWith }
    | { kind: "cancel"; orderId: string }

const ORDER_STATUS_VALUES = new Set<string>(Object.values(OrderStatus))
const PAID_WITH_VALUES = new Set<string>(PAID_WITH)

export function parseOrderCallback(data: string): OrderCallback | null {
    const [kind, orderId, status, paidWith] = data.split(":")
    if (!orderId) {
        return null
    }
    if (kind === "x") {
        return { kind: "cancel", orderId }
    }
    if (kind !== "a" || !status || !ORDER_STATUS_VALUES.has(status)) {
        return null
    }
    if (paidWith !== undefined && !PAID_WITH_VALUES.has(paidWith)) {
        return null
    }
    return { kind: "advance", orderId, to: status as OrderStatus, paidWith: paidWith as PaidWith }
}

/**
 * The next-step buttons. Delivering an unpaid order asks how the customer paid: one button each.
 */
function nextStepRows(order: OrderDTO, label: string, t: BotTexts): InlineButton[][] {
    const next = order.nextStatus
    if (next !== OrderStatus.DELIVERED || order.payment.status === PaymentStatus.PAID) {
        return [[{ text: label, callback_data: `a:${order.id}:${next ?? ""}` }]]
    }
    const options: [PaidWith, string][] = [
        [PaidWith.CASH, t.paidCash],
        [PaidWith.CARD_TRANSFER, t.paidCard],
        [PaidWith.LATER, t.paidLater],
    ]
    return options.map(([paidWith, text]) => [
        { text, callback_data: `a:${order.id}:${next}:${paidWith}` },
    ])
}

/** Owner: next-step button + cancel, or no buttons for a finished order. */
export function orderKeyboard(order: OrderDTO, reader: Reader): InlineKeyboard {
    const t = textsFor(reader.language, reader.type)
    const next = order.nextStatus
    if (!next) {
        return { inline_keyboard: [] }
    }
    return {
        inline_keyboard: [
            ...nextStepRows(order, t.actions[next] ?? next, t),
            [{ text: t.cancel, callback_data: `x:${order.id}` }],
        ],
    }
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
    return { inline_keyboard: nextStepRows(order, t.courierActions[next] ?? next, t) }
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

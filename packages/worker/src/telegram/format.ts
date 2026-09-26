import { OrderStatus, Unit, formatPhone, mapUrl } from "@lls/core"

import { escapeHtml } from "./gateway.js"
import { fill, textsFor } from "./texts.js"

import type { InlineKeyboard } from "./gateway.js"
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
    if (order.bottlesReturned > 0) {
        lines.push(fill(t.bottlesBack, { n: order.bottlesReturned }))
    }
    lines.push("", ...addressLines(order, t))
    if (order.courierName) {
        lines.push(`🚚 ${t.courier}: ${escapeHtml(order.courierName)}`)
    }
    lines.push("", `${t.status}: <b>${t.statusNames[order.status]}</b>`)
    if (order.cancelReason) {
        lines.push(`${t.reason}: ${escapeHtml(order.cancelReason)}`)
    }
    return lines.join("\n")
}

export function formatNewOrderForOwner(order: OrderDTO, reader: Reader): string {
    return `${textsFor(reader.language).newOrder}\n\n${formatOrderForOwner(order, reader)}`
}

/** The courier's card: where to go, whom to call, how much cash and how many bottles to take. */
export function formatOrderForCourier(order: OrderDTO, reader: Reader): string {
    const { language } = reader
    const t = textsFor(language, reader.type)
    const lines = [
        `<b>${t.courierCard} · ${t.order} #${order.number}</b>`,
        "",
        ...itemLines(order, t, language),
        "",
        fill(t.collect, { sum: `<b>${formatMoney(order.total, language)}</b>` }),
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

// Callback data (≤ 64 bytes): "a:<orderId>:<status>" advance, "x:<orderId>" cancel.
export type OrderCallback =
    | { kind: "advance"; orderId: string; to: OrderStatus }
    | { kind: "cancel"; orderId: string }

const ORDER_STATUS_VALUES = new Set<string>(Object.values(OrderStatus))

export function parseOrderCallback(data: string): OrderCallback | null {
    const [kind, orderId, status] = data.split(":")
    if (!orderId) {
        return null
    }
    if (kind === "x") {
        return { kind: "cancel", orderId }
    }
    if (kind === "a" && status && ORDER_STATUS_VALUES.has(status)) {
        return { kind: "advance", orderId, to: status as OrderStatus }
    }
    return null
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
            [{ text: t.actions[next] ?? next, callback_data: `a:${order.id}:${next}` }],
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
    return {
        inline_keyboard: [
            [{ text: t.courierActions[next] ?? next, callback_data: `a:${order.id}:${next}` }],
        ],
    }
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

/** Invite payload of `/start c_<code>`, or null for a plain /start. */
export function parseCourierInvite(text: string | undefined): string | null {
    const match = /^\/start\s+c_([A-Za-z0-9_-]{8,40})\s*$/.exec(text?.trim() ?? "")
    return match?.[1] ?? null
}

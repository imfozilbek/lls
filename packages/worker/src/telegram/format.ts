import { OrderStatus } from "@lls/core"

import { escapeHtml } from "./gateway.js"
import { fill, textsFor } from "./texts.js"

import type { InlineKeyboard } from "./gateway.js"
import type { Language, OrderDTO } from "@lls/core"

/** 70000 → "70 000 so'm". Narrow no-break spaces keep the number on one line. */
export function formatMoney(amount: number, language: Language): string {
    const grouped = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
    return `${grouped} ${textsFor(language).currency}`
}

function formatPhone(phone: string): string {
    if (phone.startsWith("+998") && phone.length === 13) {
        const d = phone.slice(4)
        return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`
    }
    return phone
}

function mapUrl(order: OrderDTO): string | undefined {
    if (!order.location) {
        return undefined
    }
    const { latitude, longitude } = order.location
    return `https://maps.google.com/?q=${latitude},${longitude}`
}

/** The owner's order card: items, totals, customer, address, current status. */
export function formatOrderForOwner(order: OrderDTO, language: Language): string {
    const t = textsFor(language)
    const lines = [`<b>${t.order} #${order.number}</b>`, ""]
    for (const item of order.items) {
        lines.push(
            `${escapeHtml(item.name)} × ${item.quantity} — ${formatMoney(item.total, language)}`,
        )
    }
    const delivery = order.deliveryFee === 0 ? t.free : formatMoney(order.deliveryFee, language)
    lines.push(`${t.delivery}: ${delivery}`)
    lines.push(`<b>${t.total}: ${formatMoney(order.total, language)}</b>`, "")

    const phone = order.customerPhone ? `, ${formatPhone(order.customerPhone)}` : ""
    lines.push(`👤 ${escapeHtml(order.customerName)}${phone}`)
    const landmark = order.landmark ? ` (${t.landmark}: ${escapeHtml(order.landmark)})` : ""
    lines.push(`📍 ${escapeHtml(order.address)}${landmark}`)
    const map = mapUrl(order)
    if (map) {
        lines.push(`🗺 <a href="${map}">${t.map}</a>`)
    }
    if (order.comment) {
        lines.push(`💬 ${escapeHtml(order.comment)}`)
    }
    lines.push("", `${t.status}: <b>${t.statusNames[order.status]}</b>`)
    if (order.cancelReason) {
        lines.push(`${t.reason}: ${escapeHtml(order.cancelReason)}`)
    }
    return lines.join("\n")
}

export function formatNewOrderForOwner(order: OrderDTO, language: Language): string {
    return `${textsFor(language).newOrder}\n\n${formatOrderForOwner(order, language)}`
}

export function formatStatusForCustomer(order: OrderDTO, language: Language): string | null {
    const template = textsFor(language).customerStatus[order.status]
    if (!template) {
        return null
    }
    const text = fill(template, { n: order.number })
    const reason = order.cancelReason
        ? `\n${textsFor(language).reason}: ${escapeHtml(order.cancelReason)}`
        : ""
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

/** Next-step button + cancel, or no buttons for a finished order. */
export function orderKeyboard(order: OrderDTO, language: Language): InlineKeyboard {
    const t = textsFor(language)
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

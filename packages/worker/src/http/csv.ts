import { UZ_UTC_OFFSET_MINUTES, formatPhone } from "@zumda/core"

import type { BotTexts } from "../telegram/texts.js"
import type { OrderDTO } from "@zumda/core"

/** Excel in Uzbek and Russian locales splits CSV on ";". The BOM keeps Cyrillic readable. */
const SEPARATOR = ";"
const BOM = "\uFEFF"
const MS_PER_MINUTE = 60_000

function cell(value: string | number): string {
    const text = String(value)
    return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** "2026-10-01 14:05" in Tashkent time. */
export function localDateTime(iso: string | undefined): string {
    if (!iso) {
        return ""
    }
    const local = new Date(Date.parse(iso) + UZ_UTC_OFFSET_MINUTES * MS_PER_MINUTE)
    return local.toISOString().slice(0, 16).replace("T", " ")
}

/** The owner's orders as a spreadsheet: one row per order, money in whole sum. */
export function ordersCsv(orders: readonly OrderDTO[], t: BotTexts): string {
    const c = t.csv
    const rows = orders.map((o) => [
        o.number,
        localDateTime(o.createdAt),
        t.statusNames[o.status].replace(/^\S+\s/, ""),
        o.customerName,
        o.customerPhone ? formatPhone(o.customerPhone) : "",
        o.address,
        o.subtotal,
        o.deliveryFee,
        o.depositTotal,
        o.total,
        c.payment[o.payment.status],
        localDateTime(o.payment.paidAt),
        o.courierName ?? "",
        c.channel[o.channel],
        o.commission,
    ])
    const lines = [c.headers, ...rows].map((row) => row.map(cell).join(SEPARATOR))
    return BOM + lines.join("\r\n") + "\r\n"
}

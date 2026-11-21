import {
    BusinessType,
    OrderChannel,
    cardSystemOf,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Unit,
    formatPhone,
    googleMapsUrl,
    isWeightUnit,
    mapUrl,
    twoGisUrl,
    yandexGoUrl,
    yandexMapsUrl,
} from "@zumda/core"

import { appButton } from "./app-links.js"
import { escapeHtml } from "./gateway.js"
import { fill, textsFor } from "./texts.js"

import type { InlineButton, InlineKeyboard } from "./gateway.js"
import type { BotTexts } from "./texts.js"
import type { Language, NetworkOrderDTO, OrderDTO, OrderItemDTO } from "@zumda/core"

/** Who reads a message: their language and the kind of shop the order is from. */
export interface Reader {
    language: Language
    type: BusinessType
    /** The order is of a demo shop («Namuna»): every card says it is not real. */
    demo?: boolean
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

/** What to take, without prices: the courier carries it, the money is on its own line. */
function itemNames(order: OrderDTO, t: BotTexts): string[] {
    const shown = order.items
        .slice(0, MAX_CARD_ITEMS)
        .map((item) => `${itemName(item)} ${quantityLabel(item, t)}`)
    const hidden = order.items.length - shown.length
    return hidden > 0 ? [...shown, fill(t.moreItems, { n: hidden })] : shown
}

/**
 * The order's lines in a quote that folds (Bot API 7.4): a short order shows whole, a long one
 * opens on a tap, and the card stays short. With prices, the delivery and the deposit come too,
 * and the total when the message has none above.
 */
export function itemsQuote(
    order: OrderDTO,
    reader: Reader,
    options: { prices: boolean; total: boolean },
): string {
    const { language } = reader
    const t = textsFor(language, reader.type)
    const lines = options.prices ? itemLines(order, t, language) : itemNames(order, t)
    if (options.prices) {
        const delivery = deliveryText(order, t, language)
        if (delivery) {
            lines.push(`${t.delivery}: ${delivery}`)
        }
        if (order.depositTotal > 0) {
            lines.push(`${t.deposit}: ${formatMoney(order.depositTotal, language)}`)
        }
        if (options.total) {
            lines.push(`<b>${t.total}: ${formatMoney(order.total, language)}</b>`)
        }
    }
    return `<blockquote expandable>${lines.join("\n")}</blockquote>`
}

/** The owner's card: the customer's place on Yandex Maps, at the end of the address line. */
function pinLink(order: OrderDTO, t: BotTexts): string | null {
    return order.location ? `<a href="${mapUrl(order.location)}">${t.map}</a>` : null
}

/**
 * The courier's card: the way to the customer in each navigation app (owner's decision, November
 * 2026). A message takes only https links, so Navigator goes through the app's `/navi/` page.
 */
function routeLine(order: OrderDTO, t: BotTexts, naviPage: string): string | null {
    const to = order.location
    if (!to) {
        return null
    }
    const stops = [to]
    const links: [string, string | null][] = [
        ["Yandex Navigator", `${naviPage}?to=${to.latitude.toFixed(6)},${to.longitude.toFixed(6)}`],
        ["Yandex Go", yandexGoUrl(stops)],
        ["Google Maps", googleMapsUrl(stops)],
        ["2GIS", twoGisUrl(stops)],
        ["Yandex Maps", yandexMapsUrl(stops)],
    ]
    const shown = links.flatMap(([name, url]) => (url ? [`<a href="${url}">${name}</a>`] : []))
    return `🧭 ${t.route}: ${shown.join(" · ")}`
}

function addressLines(
    order: OrderDTO,
    t: BotTexts,
    place: { link?: string | null; route?: string | null },
): string[] {
    const phone = order.customerPhone ? `, ${formatPhone(order.customerPhone)}` : ""
    const landmark = order.landmark ? ` (${t.landmark}: ${escapeHtml(order.landmark)})` : ""
    const link = place.link ? ` · ${place.link}` : ""
    const lines = [
        `👤 ${escapeHtml(order.customerName)}${phone}`,
        `📍 ${escapeHtml(order.address)}${landmark}${link}`,
    ]
    if (place.route) {
        lines.push(place.route)
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

/**
 * The fee, «bepul» when the shop promised it, or «keyin aytiladi» when the customer pays the
 * carrier. Nothing when the shop never chose a price, or for a service: no line at all.
 */
function deliveryText(order: OrderDTO, t: BotTexts, language: Language): string | null {
    if (order.customerPaysCarrier) {
        return t.deliveryApart
    }
    if (order.deliveryFee > 0) {
        return formatMoney(order.deliveryFee, language)
    }
    return order.deliveryFree ? t.free : null
}

/** The dispatcher's last notes on a card: the newest are what matters, the app has them all. */
const CARD_NOTES = 3

function noteLines(order: OrderDTO, t: BotTexts): string[] {
    return order.deliveryNotes
        .slice(-CARD_NOTES)
        .map((note) => fill(t.noteLine, { text: escapeHtml(note.text) }))
}

/** Who carries it on the owner's card: the network, a dispatcher (and how it went), a courier. */
function courierLines(order: OrderDTO, t: BotTexts): string[] {
    if (order.waitingForNetwork) {
        return [t.networkSearching]
    }
    if (!order.courierName) {
        return []
    }
    // The courier's phone next to the name: the owner calls from the chat too.
    const phone = order.courierPhone ? `, ${formatPhone(order.courierPhone)}` : ""
    const name = `${escapeHtml(order.courierName)}${phone}`
    if (order.dispatcher) {
        const sent = order.sentVia ? [fill(t.sentLine, { way: t.sendWays[order.sentVia] })] : []
        return [fill(t.dispatcherLine, { name }), ...sent, ...noteLines(order, t)]
    }
    return [order.viaNetwork ? fill(t.networkCourier, { name }) : `🚚 ${t.courier}: ${name}`]
}

/**
 * The owner's order card: the step, the number and the sum first (the line a notification
 * shows), then the money, the customer, the place, who carries it; the lines fold at the end.
 */
export function formatOrderForOwner(order: OrderDTO, reader: Reader): string {
    const { language } = reader
    const t = textsFor(language, reader.type)
    const lines = [
        ...(reader.demo ? [t.demoOrder] : []),
        `${t.statusNames[order.status]} · <b>#${order.number} · ${formatMoney(order.total, language)}</b>`,
        paymentLine(order, t),
        ...missingLines(order, t, language),
    ]
    if (order.bottlesReturned > 0) {
        lines.push(fill(t.bottlesBack, { n: order.bottlesReturned }))
    }
    lines.push(...addressLines(order, t, { link: pinLink(order, t) }))
    lines.push(...courierLines(order, t))
    if (order.channel === OrderChannel.MARKETPLACE) {
        const sum = formatMoney(order.commission, language)
        lines.push(fill(t.showcaseOrder, { rate: formatRate(order.commissionBps), sum }))
    }
    if (order.cancelReason) {
        lines.push(`${t.reason}: ${escapeHtml(order.cancelReason)}`)
    }
    lines.push(itemsQuote(order, reader, { prices: true, total: false }))
    return lines.join("\n")
}

/** «Yo'q»: the lines the shop did not have, and what it owes back for them. */
function missingLines(order: OrderDTO, t: BotTexts, language: Language): string[] {
    const lines = (order.removedItems ?? []).map((item) =>
        fill(t.lineRemovedOwner, { item: escapeHtml(item.name) }),
    )
    if (order.payment.refundOwed) {
        lines.push(
            fill(t.refundOwedOwner, { sum: formatMoney(order.payment.refundOwed, language) }),
        )
    }
    return lines
}

/**
 * The customer's message after «Yo'q»: what left the order, the new sum, and the money: owed back
 * for a transfer, or what to give the courier for cash.
 */
export function formatLineRemovedForCustomer(
    order: OrderDTO,
    item: string,
    reader: Reader,
): string {
    const t = textsFor(reader.language, reader.type)
    const sum = formatMoney(order.total, reader.language)
    const head = fill(t.lineRemovedCustomer, { n: order.number, item: escapeHtml(item), sum })
    if (order.payment.method === PaymentMethod.CASH) {
        return `${head}\n${fill(t.lineRemovedCash, { sum })}`
    }
    const owed = order.payment.refundOwed
    return owed
        ? `${head}\n${fill(t.lineRemovedRefund, { sum: formatMoney(owed, reader.language) })}`
        : head
}

const BPS_PER_PERCENT = 100

/** 500 bps → "5", 250 bps → "2,5" (Uzbek and Russian use a decimal comma). */
export function formatRate(bps: number): string {
    return String(bps / BPS_PER_PERCENT).replace(".", ",")
}

/** A new order is the card itself: its first line says «🆕 Yangi · #12 · 96 000 so'm». */
export function formatNewOrderForOwner(order: OrderDTO, reader: Reader): string {
    return formatOrderForOwner(order, reader)
}

/**
 * The courier's card in the Zumda courier bot: which shop, where to go, whom to call (the
 * customer and the shop), how many bottles to take, and the money: a transfer was paid before the
 * shop started (take nothing), cash is taken at the door. A courier may work for several shops,
 * so the shop comes first.
 */
export function formatOrderForCourier(
    order: OrderDTO,
    reader: Reader,
    shop: { name: string; phone?: string; address?: string },
    /** The courier app's `/navi/` page, which hands the route to Yandex Navigator. */
    links: { naviPage: string },
): string {
    const { language } = reader
    const t = textsFor(language, reader.type)
    const lines = [
        `<b>${escapeHtml(shop.name)} · #${order.number}</b> · ${t.statusNames[order.status]}`,
        courierMoneyLine(order, t, language),
    ]
    if (order.bottlesReturned > 0) {
        lines.push(fill(t.bottlesToCollect, { n: order.bottlesReturned }))
    }
    // Where from and where to, on every step: a dispatcher tells a taxi both.
    const shopPhone = shop.phone ? ` · ${formatPhone(shop.phone)}` : ""
    lines.push(fill(t.pickupFrom, { place: escapeHtml(shop.address ?? shop.name) + shopPhone }))
    lines.push(...addressLines(order, t, { route: routeLine(order, t, links.naviPage) }))
    if (order.sentVia) {
        lines.push(fill(t.sentLine, { way: t.sendWays[order.sentVia] }))
    }
    lines.push(...noteLines(order, t))
    if (order.status === OrderStatus.ACCEPTED || order.status === OrderStatus.PREPARING) {
        lines.push(order.dispatcher ? t.dispatcherWait : t.courierWait)
    }
    lines.push(itemsQuote(order, reader, { prices: false, total: false }))
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

/**
 * The customer's message about a step. On the way: who brings it, or how the dispatcher sent it
 * (with the note sent along, `note`), and the number to call.
 */
export function formatStatusForCustomer(
    order: OrderDTO,
    reader: Reader,
    note?: string,
): string | null {
    const t = textsFor(reader.language, reader.type)
    const onTheWay = order.status === OrderStatus.PICKED_UP && order.courierName !== undefined
    const template = onTheWay ? onTheWayText(order, t) : t.customerStatus[order.status]
    if (!template) {
        return null
    }
    const text = fill(template, { n: order.number, courier: escapeHtml(order.courierName ?? "") })
    const lines = [text + transferLine(order, t, reader.type)]
    if (onTheWay) {
        lines.push(...onTheWayLines(order, t, note))
    }
    if (order.cancelReason) {
        lines.push(`${t.reason}: ${escapeHtml(order.cancelReason)}`)
    }
    return lines.join("\n")
}

function onTheWayText(order: OrderDTO, t: BotTexts): string {
    return order.dispatcher && order.sentVia ? t.sentCustomer[order.sentVia] : t.courierOnTheWay
}

/** The note sent along, the fee to pay the carrier, and the number to call from the chat. */
function onTheWayLines(order: OrderDTO, t: BotTexts, note: string | undefined): string[] {
    const lines: string[] = []
    if (note) {
        lines.push(fill(t.noteLine, { text: escapeHtml(note) }))
    }
    if (order.customerPaysCarrier) {
        lines.push(t.carrierFeeCustomer)
    }
    if (order.courierPhone) {
        const template = order.dispatcher ? t.dispatcherPhone : t.courierPhone
        lines.push(fill(template, { phone: formatPhone(order.courierPhone) }))
    }
    return lines
}

/** A dispatcher's note on its own: «📝 #7 buyurtma: …». */
export function formatNoteForCustomer(order: OrderDTO, text: string, reader: Reader): string {
    const t = textsFor(reader.language, reader.type)
    return fill(t.noteCustomer, { n: order.number, text: escapeHtml(text) })
}

/**
 * «To'lovingiz keldi» on the message that the shop took a transfer order, once: «qabul qilindi»,
 * or a service's «qabul qilindi va bajarilmoqda» (it starts the moment it is accepted).
 */
function transferLine(order: OrderDTO, t: BotTexts, type: BusinessType): string {
    const accepted =
        order.status === OrderStatus.ACCEPTED ||
        (order.status === OrderStatus.PREPARING && type === BusinessType.SERVICE)
    return accepted &&
        order.payment.method === PaymentMethod.CARD_TRANSFER &&
        order.payment.status === PaymentStatus.PAID
        ? `\n${t.transferArrived}`
        : ""
}

/**
 * What the customer's live message says first (owner's decision, November 2026): the order's
 * step, or what just happened to it.
 */
export type CustomerEvent =
    | { kind: "status"; note?: string }
    | { kind: "note"; text: string }
    | { kind: "lineRemoved"; item: string }
    | { kind: "transferRejected" }
    | { kind: "refunded"; sum: number }

/**
 * Whether a step reaches the customer with a sound: what they wait for rings, the shop's own work
 * (collecting, ready) and the screenshot they just sent change the message quietly.
 */
export function customerStepRings(order: OrderDTO, type: BusinessType): boolean {
    switch (order.status) {
        case OrderStatus.PENDING:
            return order.payment.status === PaymentStatus.UNPAID
        case OrderStatus.PREPARING:
            // A service starts the moment it is accepted: «qabul qilindi va bajarilmoqda».
            return type === BusinessType.SERVICE
        case OrderStatus.READY:
            return false
        default:
            return true
    }
}

/**
 * The customer's one message about an order: what happened, the money, the place and whom to
 * call, the notes; the lines, the delivery and the total fold at the end.
 */
export function formatCustomerCard(
    order: OrderDTO,
    reader: Reader,
    event: CustomerEvent,
    shopPhone?: string,
): string {
    const t = textsFor(reader.language, reader.type)
    return [
        ...customerHeadline(order, reader, event, t),
        ...customerDetails(order, reader, event, shopPhone),
        itemsQuote(order, reader, { prices: true, total: true }),
    ].join("\n")
}

function customerHeadline(
    order: OrderDTO,
    reader: Reader,
    event: CustomerEvent,
    t: BotTexts,
): string[] {
    const step = t.statusNames[order.status]
    switch (event.kind) {
        case "note":
            return [formatNoteForCustomer(order, event.text, reader), step]
        case "lineRemoved":
            return [formatLineRemovedForCustomer(order, event.item, reader), step]
        case "transferRejected":
            return [fill(t.transferRejectedCustomer, { n: order.number }), ...cardLines(order, t)]
        case "refunded": {
            const sum = formatMoney(event.sum, reader.language)
            return [fill(t.refundedCustomer, { n: order.number, sum }), step]
        }
        case "status":
            return order.status === OrderStatus.PENDING
                ? placedLines(order, reader, t)
                : [formatStatusForCustomer(order, reader, event.note) ?? step]
    }
}

/** A new order: how to pay it, or that the screenshot is with the shop. */
function placedLines(order: OrderDTO, reader: Reader, t: BotTexts): string[] {
    const sum = `<b>${formatMoney(order.total, reader.language)}</b>`
    if (order.payment.method === PaymentMethod.CASH) {
        return [fill(t.payByCash, { n: order.number, sum })]
    }
    const head = fill(t.placed, { n: order.number })
    if (order.payment.status === PaymentStatus.AWAITING) {
        return [head, t.transferSentCustomer]
    }
    return [head, fill(t.transferTo, { sum }), ...cardLines(order, t)]
}

/** The card this order was shown, grouped by four, with its system when Zumda knows it. */
function cardLines(order: OrderDTO, t: BotTexts): string[] {
    const card = order.payment.card
    if (!card) {
        return []
    }
    const system = cardSystemOf(card.number)
    const number = card.number.replace(/(\d{4})(?=\d)/g, "$1 ")
    const name = system ? `${t.cardSystems[system]} ` : ""
    return [`${name}<code>${number}</code> (${escapeHtml(card.holder)})`]
}

/**
 * Under the first line: the cash still to give, the carrier's price to come, the notes, the
 * place, and whom to call (the courier on the way, always the shop).
 */
function customerDetails(
    order: OrderDTO,
    reader: Reader,
    event: CustomerEvent,
    shopPhone: string | undefined,
): string[] {
    const t = textsFor(reader.language, reader.type)
    const landmark = order.landmark ? ` (${t.landmark}: ${escapeHtml(order.landmark)})` : ""
    return [
        ...moneyAhead(order, reader, event, t),
        ...customerNotes(order, event, t),
        `📍 ${escapeHtml(order.address)}${landmark}`,
        ...whomToCall(order, event, t, shopPhone),
    ]
}

/** What the customer still pays: the cash for the courier, the carrier's price to come. */
function moneyAhead(order: OrderDTO, reader: Reader, event: CustomerEvent, t: BotTexts): string[] {
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
        return []
    }
    const lines: string[] = []
    // A new cash order says it in its first line, and «Yo'q» says the new sum itself.
    const cashToGive =
        order.payment.method === PaymentMethod.CASH &&
        order.payment.status !== PaymentStatus.PAID &&
        order.status !== OrderStatus.PENDING &&
        event.kind !== "lineRemoved"
    if (cashToGive) {
        const sum = formatMoney(order.total, reader.language)
        lines.push(`💵 ${fill(t.lineRemovedCash, { sum })}`)
    }
    if (order.customerPaysCarrier && order.status !== OrderStatus.PICKED_UP) {
        lines.push(t.carrierPriceLater)
    }
    return lines
}

/** The dispatcher's last notes; the one the first line just said is not said twice. */
function customerNotes(order: OrderDTO, event: CustomerEvent, t: BotTexts): string[] {
    const said = event.kind === "note" ? event.text : event.kind === "status" ? event.note : null
    return order.deliveryNotes
        .filter((note) => note.text !== said)
        .slice(-CARD_NOTES)
        .map((note) => fill(t.noteLine, { text: escapeHtml(note.text) }))
}

/** The courier once on the way (unless the first line named them), and always the shop. */
function whomToCall(
    order: OrderDTO,
    event: CustomerEvent,
    t: BotTexts,
    shopPhone: string | undefined,
): string[] {
    const lines: string[] = []
    const courierSaid =
        event.kind === "status" &&
        order.status === OrderStatus.PICKED_UP &&
        order.courierName !== undefined
    const courierLeft =
        order.status === OrderStatus.PICKED_UP || order.status === OrderStatus.DELIVERED
    if (order.courierPhone && courierLeft && !courierSaid) {
        const template = order.dispatcher ? t.dispatcherPhone : t.courierPhone
        lines.push(fill(template, { phone: formatPhone(order.courierPhone) }))
    }
    if (shopPhone) {
        lines.push(fill(t.shopPhone, { phone: formatPhone(shopPhone) }))
    }
    return lines
}

/**
 * Under the customer's message: while a transfer is to be made, the card number to copy and
 * «Chekni yuklash»; after it, the order in the app.
 */
export function customerKeyboard(
    order: OrderDTO,
    reader: Reader,
    orderUrl: string,
): InlineKeyboard {
    const t = textsFor(reader.language, reader.type)
    const card = order.payment.card
    const toPay =
        order.status === OrderStatus.PENDING &&
        order.payment.method === PaymentMethod.CARD_TRANSFER &&
        order.payment.status === PaymentStatus.UNPAID
    if (!toPay || !card) {
        return { inline_keyboard: [[appButton(t.openOrder, orderUrl)]] }
    }
    return {
        inline_keyboard: [
            [{ text: t.copyCard, copy_text: { text: card.number.replace(/\D/g, "") } }],
            [{ ...appButton(t.uploadReceipt, orderUrl), style: "primary" }],
        ],
    }
}

// Callback data (≤ 64 bytes): "a:<orderId>:<status>" advance, "x:<orderId>" cancel,
// "p:<orderId>" «Деньги пришли, принять» (asks first), "pc:<orderId>" yes, the money is here,
// "pn:<orderId>" «Pul kelmadi», "m:<orderId>" «O'zim yetkazaman».
export type OrderCallback =
    | { kind: "advance"; orderId: string; to: OrderStatus }
    | { kind: "cancel"; orderId: string }
    | { kind: "askPaid"; orderId: string }
    | { kind: "paid"; orderId: string }
    | { kind: "notPaid"; orderId: string }
    | { kind: "deliverMyself"; orderId: string }

type SimpleCallback = "cancel" | "askPaid" | "paid" | "notPaid" | "deliverMyself"

const SIMPLE_CALLBACKS: Record<string, SimpleCallback> = {
    x: "cancel",
    p: "askPaid",
    pc: "paid",
    pn: "notPaid",
    m: "deliverMyself",
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
 * Who takes an order nobody is on yet, as the owner's card offers it: «Kuryerga topshirish» in
 * the app (`url`) when the shop has couriers, else «O'zim yetkazaman» right in the chat.
 */
export interface CourierChoice {
    url: string
    shopHasCouriers: boolean
}

/**
 * Owner: the next step + cancel, or no buttons for a finished order. A new transfer order waits
 * for the customer's screenshot with only cancel; once it came, its step is «Pul keldi, qabul
 * qilish» (owner's decision, November 2026). A cash order is accepted at once. An order nobody
 * is on yet asks who takes it (`choice`) before «Tayyor»; the dispatcher's steps are never on the
 * owner's card.
 */
export function orderKeyboard(
    order: OrderDTO,
    reader: Reader,
    choice?: CourierChoice,
): InlineKeyboard {
    const t = textsFor(reader.language, reader.type)
    const next = order.nextStatus
    if (!next) {
        return { inline_keyboard: [] }
    }
    const cancel: InlineButton[] = [
        { text: t.cancel, callback_data: `x:${order.id}`, style: "danger" },
    ]
    const leavesTheShop = next === OrderStatus.READY || next === OrderStatus.PICKED_UP
    if (order.dispatcher && (next === OrderStatus.PICKED_UP || next === OrderStatus.DELIVERED)) {
        return { inline_keyboard: [cancel] }
    }
    if (choice && order.needsCourierChoice && leavesTheShop) {
        const who: InlineButton = choice.shopHasCouriers
            ? { ...appButton(t.chooseCourier, choice.url), style: "success" }
            : { text: t.deliverMyself, callback_data: `m:${order.id}`, style: "success" }
        return { inline_keyboard: [[who], cancel] }
    }
    const money = moneyStep(order, next, t)
    if (money === "wait") {
        return { inline_keyboard: [cancel] }
    }
    const step: InlineButton = money ?? {
        text: t.actions[next] ?? next,
        callback_data: `a:${order.id}:${next}`,
        style: "success",
    }
    return { inline_keyboard: [[step], cancel] }
}

/**
 * A new transfer order before the money: «Pul keldi, qabul qilish» once the customer's
 * screenshot came, "wait" before it; null when the money is not the next thing.
 */
function moneyStep(order: OrderDTO, next: OrderStatus, t: BotTexts): InlineButton | "wait" | null {
    if (
        next !== OrderStatus.ACCEPTED ||
        isPaid(order) ||
        order.payment.method === PaymentMethod.CASH
    ) {
        return null
    }
    if (order.payment.status === PaymentStatus.UNPAID) {
        return "wait"
    }
    return { text: t.paidAccept, callback_data: `p:${order.id}`, style: "success" }
}

/**
 * «Pul keldi» under the customer's screenshot: the owner answers after looking at the bank app,
 * never by reflex.
 */
export function confirmPaidKeyboard(order: OrderDTO, t: BotTexts, sum: string): InlineKeyboard {
    return {
        inline_keyboard: [
            [
                {
                    text: fill(t.confirmPaidYes, { sum }),
                    callback_data: `pc:${order.id}`,
                    style: "success",
                },
            ],
            [{ text: t.confirmPaidNo, callback_data: `pn:${order.id}`, style: "danger" }],
        ],
    }
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

/**
 * Courier: "Picked up" once the order is ready, then "Delivered". Nothing before or after. A
 * dispatcher's «Jo'natdim» asks the way and a note: it opens the order in the app (`sendUrl`).
 */
export function courierKeyboard(order: OrderDTO, reader: Reader, sendUrl?: string): InlineKeyboard {
    const t = textsFor(reader.language, reader.type)
    const copy = copyAddressButton(order, t)
    const rows = (step: InlineButton | null): InlineKeyboard => ({
        inline_keyboard: [...(step ? [[step]] : []), ...(copy ? [[copy]] : [])],
    })
    if (order.dispatcher && order.status === OrderStatus.READY) {
        return rows(sendUrl ? { ...appButton(t.dispatcherSend, sendUrl), style: "success" } : null)
    }
    const next =
        order.status === OrderStatus.READY || order.status === OrderStatus.PICKED_UP
            ? order.nextStatus
            : null
    if (!next) {
        return rows(null)
    }
    const cash =
        next === OrderStatus.DELIVERED &&
        order.payment.method === PaymentMethod.CASH &&
        order.payment.status !== PaymentStatus.PAID
    const text = cash ? t.cashDelivered : (t.courierActions[next] ?? next)
    return rows({ text, callback_data: `a:${order.id}:${next}`, style: "success" })
}

/** Bot API: a copied text is at most 256 characters. */
const COPY_TEXT_MAX = 256

/**
 * «Manzil va telefonni nusxalash»: the place and whom to call in one tap, for a taxi driver or a
 * navigation app. Gone once the order is done.
 */
function copyAddressButton(order: OrderDTO, t: BotTexts): InlineButton | null {
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
        return null
    }
    const landmark = order.landmark ? ` (${t.landmark}: ${order.landmark})` : ""
    const phone = order.customerPhone ? `, ${formatPhone(order.customerPhone)}` : ""
    const text = `${order.address}${landmark}, ${order.customerName}${phone}`
    return { text: t.copyAddress, copy_text: { text: text.slice(0, COPY_TEXT_MAX) } }
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
                {
                    text: t.approveCourier,
                    callback_data: `k:${courierId}:approve`,
                    style: "success",
                },
                {
                    text: t.declineCourier,
                    callback_data: `k:${courierId}:decline`,
                    style: "danger",
                },
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

/** `/start s_<code>`: a post's button or an ad link of the shop was pressed. */
export function parseSourceStart(text: string | undefined): string | null {
    return /^\/start\s+s_([A-Za-z0-9_-]{11})\s*$/.exec(text ?? "")?.[1] ?? null
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
    return {
        inline_keyboard: [[{ text: t.takeOrder, callback_data: `n:${orderId}`, style: "success" }]],
    }
}

/** The one-time offer to join the district network: "net:join" / "net:skip". */
export function networkInviteKeyboard(t: BotTexts): InlineKeyboard {
    return {
        inline_keyboard: [
            [
                { text: t.joinNetwork, callback_data: "net:join", style: "success" },
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

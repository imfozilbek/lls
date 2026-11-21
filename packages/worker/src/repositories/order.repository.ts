import {
    ConflictError,
    ACTIVE_ORDER_STATUSES,
    CATEGORIES,
    DELIVERY_FEE_RECIPIENTS,
    Location,
    Money,
    ORDER_CHANNELS,
    ORDER_STATUSES,
    Order,
    OrderItem,
    OrderStatus,
    PAYMENT_METHODS,
    PAYMENT_STATUSES,
    Payment,
    PayoutCard,
    Phone,
    SEND_WAYS,
    UNITS,
    deliveryNote,
    offsetOf,
} from "@zumda/core"

import {
    IN_CHUNK,
    Versions,
    flag,
    isUniqueViolation,
    oneOf,
    optional,
    placeholders,
} from "./rows.js"

import type {
    CancelledBy,
    ChosenOptions,
    DeliveryNote,
    MoneyTotals,
    NetworkShare,
    OrderInsert,
    OrderRepository,
    Page,
    PageRequest,
    TransferReceipt,
} from "@zumda/core"

interface OrderRow {
    id: string
    business_id: string
    number: number
    customer_id: string
    channel: string
    status: string
    subtotal: number
    delivery_fee: number
    deposit_total: number
    bottles_returned: number
    total: number
    commission_bps: number
    commission: number
    courier_id: string | null
    courier_name: string | null
    courier_phone: string | null
    address: string
    landmark: string | null
    latitude: number | null
    longitude: number | null
    comment: string | null
    customer_name: string
    customer_phone: string | null
    cancel_reason: string | null
    cancelled_by: string | null
    payment_method: string
    payment_status: string
    paid_at: number | null
    cash_courier_id: string | null
    delivered_at: number | null
    created_at: number
    updated_at: number
    network_requested_at: number | null
    network_alerted_at: number | null
    delivery_fee_to: string
    payment_card_number: string | null
    payment_card_holder: string | null
    receipt_key: string | null
    receipt_hash: string | null
    receipt_at: number | null
    receipt_reused_from: number | null
    customer_rejections: number
    transfer_rejections: number
    transfer_reminded_at: number | null
    cash_received_at: number | null
    trip_id: string | null
    trip_stop: number | null
    dispatcher: number
    owner_delivers: number
    sent_via: string | null
    delivery_notes: string | null
    customer_pays_carrier: number
    refund_owed: number
    delivery_free: number
    source_link_id: string | null
}

interface ItemRow {
    order_id: string
    line: number
    product_id: string
    name: string
    unit: string
    category: string
    unit_price: number
    quantity: number
    options: string | null
    from_stock: number | null
    removed_at: number | null
}

/** Who gets a Telegram card for an order; each card is edited in place on status changes. */
export type OrderCardHolder = "owner" | "courier" | "customer"

/** The bot that holds the owner's card: the shop's own, or Zumda | Business instead. */
export type OwnerCardBot = "shop" | "business"

/** The Telegram messages of an order: the owner's and the courier's cards, the customer's one. */
export interface OrderMessages {
    owner: number | null
    ownerVia: OwnerCardBot
    courier: number | null
    customer: number | null
}

const MESSAGE_COLUMNS: Record<OrderCardHolder, string> = {
    owner: "owner_message_id",
    courier: "courier_message_id",
    customer: "customer_message_id",
}

const COLUMNS = `id, business_id, number, customer_id, channel, status, subtotal, delivery_fee,
    deposit_total, bottles_returned, total, commission_bps, commission, courier_id, courier_name,
    courier_phone, address, landmark, latitude, longitude, comment, customer_name, customer_phone,
    cancel_reason, cancelled_by, payment_method, payment_status, paid_at, cash_courier_id,
    delivered_at, created_at, updated_at, network_requested_at, network_alerted_at,
    delivery_fee_to, payment_card_number, payment_card_holder, receipt_key, receipt_hash,
    receipt_at, receipt_reused_from, customer_rejections, transfer_rejections,
    transfer_reminded_at, cash_received_at, trip_id, trip_stop, dispatcher, owner_delivers,
    sent_via, delivery_notes, customer_pays_carrier, refund_owed, delivery_free, source_link_id`

/** A cash order whose money a courier still holds. */
const WITH_COURIER = `payment_method = 'cash' AND payment_status = 'paid'
    AND cash_courier_id IS NOT NULL AND cash_received_at IS NULL`

/**
 * «Pul»: transfers to check or to return. By (business, payment status): sorting by number would
 * otherwise walk the shop's whole history to find the few open ones.
 */
export const OPEN_PAYMENTS_FROM = "orders INDEXED BY idx_orders_business_payment"
export const OPEN_PAYMENTS_WHERE =
    "business_id = ? AND payment_status IN ('awaiting', 'refund_due')"
/** Cash a courier still holds: only those rows (partial index, migration 0018). */
export const CASH_OPEN_FROM = "orders INDEXED BY idx_orders_cash_open"
export const CASH_OPEN_WHERE = `business_id = ? AND ${WITH_COURIER}`

/** Demo shops («Namuna»): their orders are not real, so a customer's history never counts them. */
const DEMO_SHOPS = "SELECT id FROM businesses WHERE demo_at IS NOT NULL"

/** Refused transfers of a customer: only the refused orders (partial index, migration 0018). */
export const TRANSFER_REJECTIONS_SQL = `SELECT COALESCE(SUM(transfer_rejections), 0) AS total
    FROM orders INDEXED BY idx_orders_customer_rejected
    WHERE customer_id = ? AND id != ? AND transfer_rejections > 0
      AND business_id NOT IN (${DEMO_SHOPS})`

/**
 * The same screenshot came before: in this shop, or from this customer at a real shop (a demo's
 * orders are not real, so they never warn a real one).
 */
export const RECEIPT_REUSE_SQL = `SELECT business_id, number FROM orders
    WHERE receipt_hash = ? AND id != ?
      AND (business_id = ? OR (customer_id = ? AND business_id NOT IN (${DEMO_SHOPS})))
    ORDER BY created_at LIMIT 1`

/** A courier can still take the order: from accepted until pickup. */
const TAKEABLE = [OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY]

const ITEM_COLUMNS =
    "order_id, line, product_id, name, unit, category, unit_price, quantity, options, from_stock"
/** Read with the mark of a line taken out («Yo'q»); a new order writes none. */
const ITEM_READ_COLUMNS = `${ITEM_COLUMNS}, removed_at`

/** «Pul» → «Qaytarish»: the part owed for missing lines, by its partial index (migration 0029). */
export const REFUND_OWED_FROM = "orders INDEXED BY idx_orders_refund_owed"
export const REFUND_OWED_WHERE = "business_id = ? AND refund_owed > 0"

/** «Yo'q»: the line is marked only when this very save changed the order (its new version). */
export const LINE_REMOVED_SQL = `UPDATE order_items SET removed_at = ?
    WHERE order_id = ? AND line = ? AND removed_at IS NULL
      AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND updated_at = ?)`

/**
 * An order takes what it ordered of a counted product. The column's CHECK (never below zero) fails
 * the whole batch when less is left: the order and its lines are not kept either.
 */
export const STOCK_TAKE_SQL = `UPDATE products SET stock = stock - ?
    WHERE id = ? AND business_id = ? AND stock IS NOT NULL`

/**
 * A cancel gives it back, only when this very save cancelled the order (its status and the new
 * version are in the row): a stale copy or a second save never gives it twice.
 */
export const STOCK_RETURN_SQL = `UPDATE products SET stock = stock + ?
    WHERE id = ? AND business_id = ? AND stock IS NOT NULL
      AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = 'cancelled' AND updated_at = ?)`

/** The order counts for the post or ad link the customer pressed last (in the insert's batch). */
export const LINK_ORDER_SQL = `UPDATE source_links SET orders = orders + 1
    WHERE id = ? AND business_id = ?`

/**
 * A delivered order counts as a sale of its link, with its goods: only when this very save
 * delivered it (its status and the new version are in the row), so never twice.
 */
export const LINK_SALE_SQL = `UPDATE source_links SET sales = sales + 1, revenue = revenue + ?
    WHERE id = ? AND business_id = ?
      AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = 'delivered' AND updated_at = ?)`

/** SQLite's words when a product's stock would go below zero. */
function isStockShortage(error: unknown): boolean {
    return error instanceof Error && error.message.includes("CHECK constraint failed")
}

const CANCELLED_BY: readonly CancelledBy[] = ["customer", "owner"]

const EMPTY_TOTALS: MoneyTotals = {
    placed: 0,
    delivered: 0,
    cancelled: 0,
    goods: 0,
    delivery: 0,
    deposits: 0,
    paid: 0,
    paidCash: 0,
    commission: 0,
}

/** Most a courier's screen shows at once: today's work fits easily. */
const COURIER_LIST_LIMIT = 50

const FINAL_ORDER_STATUSES = ORDER_STATUSES.filter((s) => !ACTIVE_ORDER_STATUSES.includes(s))

/** A page of orders, newest first; binds: the where's values, then limit and offset. */
export function pageSql(from: string, where: string): string {
    return `SELECT ${COLUMNS} FROM ${from} WHERE ${where} ORDER BY number DESC LIMIT ? OFFSET ?`
}

/** By (business_id, status, number): an «active» page never walks the shop's history. */
export const BY_STATUS = "orders INDEXED BY idx_orders_business_status"

export function shopStatusWhere(statuses: number): string {
    return `business_id = ? AND status IN (${placeholders(statuses)})`
}

/**
 * The owner's screen polls this every 20 s: only the shop's open orders, by
 * `idx_orders_business_status`. Binds: shop, active statuses.
 */
export const ACTIVE_VERSION_SQL = `SELECT COUNT(*) AS open, MAX(updated_at) AS latest
    FROM orders INDEXED BY idx_orders_business_status
    WHERE business_id = ? AND status IN (${placeholders(ACTIVE_ORDER_STATUSES.length)})`

/**
 * Network orders nobody took yet: only the open ones are in `idx_orders_network_open` (0016), so
 * finished history is never read. The statuses are literals: a partial index is used only when
 * the query repeats its condition. Binds: district ids, limit.
 */
export function networkWaitingSql(districts: number, unalerted: boolean): string {
    return `SELECT ${COLUMNS} FROM orders INDEXED BY idx_orders_network_open
        WHERE network_requested_at IS NOT NULL AND courier_id IS NULL
            AND status IN (${TAKEABLE.map((status) => `'${status}'`).join(", ")})
            ${unalerted ? "AND network_alerted_at IS NULL" : ""}
            AND business_id IN (SELECT id FROM businesses
                WHERE district_id IN (${placeholders(districts)}))
        ORDER BY network_requested_at ASC LIMIT ?`
}

/**
 * A courier's orders: every open one, and today's finished ones. Two index ranges
 * (`idx_orders_courier`: courier, status, updated_at), so the history of the link is never read.
 * Binds: courier, active statuses, courier, final statuses, since, limit.
 */
export const COURIER_ORDERS_SQL = `SELECT ${COLUMNS} FROM (
        SELECT ${COLUMNS} FROM orders
        WHERE courier_id = ? AND status IN (${placeholders(ACTIVE_ORDER_STATUSES.length)})
        UNION ALL
        SELECT ${COLUMNS} FROM orders
        WHERE courier_id = ? AND status IN (${placeholders(FINAL_ORDER_STATUSES.length)})
            AND updated_at >= ?
    ) ORDER BY number DESC LIMIT ?`

export function courierOrdersBinds(
    courierId: string,
    since: Date,
    limit = COURIER_LIST_LIMIT,
): (string | number)[] {
    return [
        courierId,
        ...ACTIVE_ORDER_STATUSES,
        courierId,
        ...FINAL_ORDER_STATUSES,
        since.getTime(),
        limit,
    ]
}

function toItem(row: ItemRow): OrderItem {
    return OrderItem.create({
        productId: row.product_id,
        name: row.name,
        unit: oneOf(row.unit, UNITS, "unit"),
        category: oneOf(row.category, CATEGORIES, "category"),
        unitPrice: Money.of(row.unit_price),
        quantity: row.quantity,
        options: row.options === null ? undefined : (JSON.parse(row.options) as ChosenOptions),
        fromStock: row.from_stock === 1,
        removedAt: dateOrUndefined(row.removed_at),
    })
}

const versions = new Versions<Order>()

/** What a save may change, in the order of `mutableValues`. */
const MUTABLE_COLUMNS = [
    "status",
    "courier_id",
    "courier_name",
    "courier_phone",
    "cancel_reason",
    "cancelled_by",
    "payment_method",
    "payment_status",
    "paid_at",
    "cash_courier_id",
    "delivered_at",
    "network_requested_at",
    "network_alerted_at",
    "delivery_fee_to",
    "receipt_key",
    "receipt_hash",
    "receipt_at",
    "receipt_reused_from",
    "customer_rejections",
    "transfer_rejections",
    "transfer_reminded_at",
    "cash_received_at",
    "trip_id",
    "trip_stop",
    "dispatcher",
    "owner_delivers",
    "sent_via",
    "delivery_notes",
    "subtotal",
    "deposit_total",
    "total",
    "commission",
    "refund_owed",
] as const

/**
 * The values each loaded or saved order had: a save writes only the columns that changed. D1
 * counts every index entry rewritten as a row written (the free plan's 100k a day), and `orders`
 * has a dozen indexes: writing every column on each step rewrote nearly all of them.
 */
const written = new WeakMap<Order, (string | number | null)[]>()

function toOrder(row: OrderRow, items: ItemRow[]): Order {
    const order = Order.reconstitute({
        id: row.id,
        businessId: row.business_id,
        customerId: row.customer_id,
        number: row.number,
        channel: oneOf(row.channel, ORDER_CHANNELS, "order channel"),
        items: items.sort((a, b) => a.line - b.line).map(toItem),
        subtotal: Money.of(row.subtotal),
        deliveryFee: Money.of(row.delivery_fee),
        depositTotal: Money.of(row.deposit_total),
        bottlesReturned: row.bottles_returned,
        total: Money.of(row.total),
        commissionBps: row.commission_bps,
        commission: Money.of(row.commission),
        status: oneOf(row.status, ORDER_STATUSES, "order status"),
        courierId: optional(row.courier_id),
        courierName: optional(row.courier_name),
        courierPhone: row.courier_phone === null ? undefined : Phone.fromStored(row.courier_phone),
        address: row.address,
        landmark: optional(row.landmark),
        location:
            row.latitude === null || row.longitude === null
                ? undefined
                : Location.create(row.latitude, row.longitude),
        comment: optional(row.comment),
        customerName: row.customer_name,
        customerPhone:
            row.customer_phone === null ? undefined : Phone.fromStored(row.customer_phone),
        cancelReason: optional(row.cancel_reason),
        cancelledBy:
            row.cancelled_by === null
                ? undefined
                : oneOf(row.cancelled_by, CANCELLED_BY, "cancelled_by"),
        payment: Payment.reconstitute({
            method: oneOf(row.payment_method, PAYMENT_METHODS, "payment method"),
            status: oneOf(row.payment_status, PAYMENT_STATUSES, "payment status"),
            paidAt: row.paid_at === null ? undefined : new Date(row.paid_at),
            cashCourierId: optional(row.cash_courier_id),
            cashReceivedAt: dateOrUndefined(row.cash_received_at),
            card:
                row.payment_card_number === null || row.payment_card_holder === null
                    ? undefined
                    : PayoutCard.create(row.payment_card_number, row.payment_card_holder),
            receipt: toReceipt(row),
            rejections: row.transfer_rejections,
            remindedAt: dateOrUndefined(row.transfer_reminded_at),
            refundOwed: Money.of(row.refund_owed),
        }),
        deliveredAt: row.delivered_at === null ? undefined : new Date(row.delivered_at),
        networkRequestedAt: dateOrUndefined(row.network_requested_at),
        networkAlertedAt: dateOrUndefined(row.network_alerted_at),
        deliveryFeeTo: oneOf(row.delivery_fee_to, DELIVERY_FEE_RECIPIENTS, "delivery_fee_to"),
        tripId: optional(row.trip_id),
        tripStop: optional(row.trip_stop),
        dispatcher: row.dispatcher === 1,
        ownerDelivers: row.owner_delivers === 1,
        sentVia: row.sent_via === null ? undefined : oneOf(row.sent_via, SEND_WAYS, "sent_via"),
        deliveryNotes: notesOf(row.delivery_notes),
        customerPaysCarrier: row.customer_pays_carrier === 1,
        deliveryFree: row.delivery_free === 1,
        sourceLinkId: optional(row.source_link_id),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    })
    written.set(order, mutableValues(order))
    return versions.remember(order, row.updated_at)
}

function toReceipt(row: OrderRow): TransferReceipt | undefined {
    if (row.receipt_key === null || row.receipt_hash === null || row.receipt_at === null) {
        return undefined
    }
    return {
        key: row.receipt_key,
        hash: row.receipt_hash,
        at: new Date(row.receipt_at),
        reusedFrom: optional(row.receipt_reused_from),
        customerRejections: row.customer_rejections,
    }
}

/** The dispatcher's notes as stored: `[{ at, text }]`, `at` in unix ms. */
function notesOf(stored: string | null): DeliveryNote[] {
    if (stored === null) {
        return []
    }
    const rows = JSON.parse(stored) as { at: number; text: string }[]
    return rows.map((note) => deliveryNote(note.text, new Date(note.at)))
}

function storedNotes(order: Order): string | null {
    const notes = order.deliveryNotes
    return notes.length === 0
        ? null
        : JSON.stringify(notes.map((note) => ({ at: note.at.getTime(), text: note.text })))
}

/** Who carries it: a dispatcher, the owner himself; how it was sent; the notes. */
function dispatchValues(order: Order): (string | number | null)[] {
    return [
        flag(order.isWithDispatcher()),
        flag(order.ownerDelivers),
        order.sentVia ?? null,
        storedNotes(order),
    ]
}

function dateOrUndefined(value: number | null): Date | undefined {
    return value === null ? undefined : new Date(value)
}

function networkValues(order: Order): (string | number | null)[] {
    return [
        order.networkRequestedAt?.getTime() ?? null,
        order.networkAlertedAt?.getTime() ?? null,
        order.deliveryFeeTo,
    ]
}

function orderValues(order: Order): (string | number | null)[] {
    return [
        order.id,
        order.businessId,
        order.number,
        order.customerId,
        order.channel,
        order.status,
        order.subtotal.amount,
        order.deliveryFee.amount,
        order.depositTotal.amount,
        order.bottlesReturned,
        order.total.amount,
        order.commissionBps,
        order.commission.amount,
        order.courierId ?? null,
        order.courierName ?? null,
        order.courierPhone?.number ?? null,
        order.address,
        order.landmark ?? null,
        order.location?.latitude ?? null,
        order.location?.longitude ?? null,
        order.comment ?? null,
        order.customerName,
        order.customerPhone?.number ?? null,
        order.cancelReason ?? null,
        order.cancelledBy ?? null,
        ...paymentValues(order),
        order.createdAt.getTime(),
        order.updatedAt.getTime(),
        ...networkValues(order),
        ...cardValues(order),
        ...receiptValues(order),
        ...cashValues(order),
        ...tripValues(order),
        ...dispatchValues(order),
        flag(order.customerPaysCarrier),
        order.payment.refundOwed.amount,
        flag(order.deliveryFree),
        ...sourceValues(order),
    ]
}

/** The link the customer pressed last: a snapshot. */
function sourceValues(order: Order): (string | null)[] {
    return [order.sourceLinkId ?? null]
}

function cashValues(order: Order): (number | null)[] {
    return [order.payment.cashReceivedAt?.getTime() ?? null]
}

function tripValues(order: Order): (string | number | null)[] {
    return [order.tripId ?? null, order.tripStop ?? null]
}

function receiptValues(order: Order): (string | number | null)[] {
    const { receipt } = order.payment
    return [
        receipt?.key ?? null,
        receipt?.hash ?? null,
        receipt?.at.getTime() ?? null,
        receipt?.reusedFrom ?? null,
        receipt?.customerRejections ?? 0,
        order.payment.rejections,
        order.payment.remindedAt?.getTime() ?? null,
    ]
}

/** Written once: the card the customer was shown never changes with the order. */
function cardValues(order: Order): (string | null)[] {
    const { card } = order.payment
    return [card?.number ?? null, card?.holder ?? null]
}

function mutableValues(order: Order): (string | number | null)[] {
    return [
        order.status,
        order.courierId ?? null,
        order.courierName ?? null,
        order.courierPhone?.number ?? null,
        order.cancelReason ?? null,
        order.cancelledBy ?? null,
        ...paymentValues(order),
        ...networkValues(order),
        ...receiptValues(order),
        ...cashValues(order),
        ...tripValues(order),
        ...dispatchValues(order),
        ...sumValues(order),
    ]
}

/** The sums «Yo'q» rewrites; the delivery fee and the commission rate never change. */
function sumValues(order: Order): number[] {
    return [
        order.subtotal.amount,
        order.depositTotal.amount,
        order.total.amount,
        order.commission.amount,
        order.payment.refundOwed.amount,
    ]
}

function paymentValues(order: Order): (string | number | null)[] {
    const { payment } = order
    return [
        payment.method,
        payment.status,
        payment.paidAt?.getTime() ?? null,
        payment.cashCourierId ?? null,
        order.deliveredAt?.getTime() ?? null,
    ]
}

/** An order's save as one statement, for a batch with other writes. */
export interface OrderSave {
    statement: D1PreparedStatement
    /** The version the row must still have; none for an order this Worker never loaded. */
    expected: number | undefined
    /** The version this save writes. */
    version: number
    /** After the statement changed the row: what the next save compares with. */
    saved(): void
}

/**
 * The save of `save()` as a statement: only the columns changed since the order was loaded, over
 * the version it was loaded with, and only while `also` holds (its SQL and binds), when given.
 */
export function orderSaveStatement(
    db: D1Database,
    order: Order,
    also?: { sql: string; binds: readonly (string | number)[] },
): OrderSave {
    const { expected, version } = versions.next(order, order.updatedAt)
    const values = mutableValues(order)
    if (values.length !== MUTABLE_COLUMNS.length) {
        // A column added to one list and not the other would write values into wrong columns.
        throw new Error("MUTABLE_COLUMNS and mutableValues differ")
    }
    const before = written.get(order)
    const changed = MUTABLE_COLUMNS.flatMap((column, index) =>
        before !== undefined && before[index] === values[index]
            ? []
            : [{ column, value: values[index] ?? null }],
    )
    const set = [...changed.map(({ column }) => `${column} = ?`), "updated_at = ?"].join(", ")
    const guard = expected === undefined ? "" : " AND updated_at = ?"
    const statement = db
        .prepare(`UPDATE orders SET ${set} WHERE id = ?${guard}${also ? ` AND ${also.sql}` : ""}`)
        .bind(
            ...changed.map(({ value }) => value),
            version,
            order.id,
            ...(expected === undefined ? [] : [expected]),
            ...(also?.binds ?? []),
        )
    return {
        statement,
        expected,
        version,
        saved: (): void => {
            written.set(order, values)
            versions.remember(order, version)
        },
    }
}

export class D1OrderRepository implements OrderRepository {
    constructor(private readonly db: D1Database) {}

    async findById(id: string): Promise<Order | null> {
        const [orders, items] = await this.db.batch([
            this.db.prepare(`SELECT ${COLUMNS} FROM orders WHERE id = ?`).bind(id),
            this.db
                .prepare(`SELECT ${ITEM_READ_COLUMNS} FROM order_items WHERE order_id = ?`)
                .bind(id),
        ])
        const row = orders?.results[0] as OrderRow | undefined
        return row ? toOrder(row, (items?.results ?? []) as ItemRow[]) : null
    }

    async nextNumber(businessId: string): Promise<number> {
        const row = await this.db
            .prepare(
                "SELECT COALESCE(MAX(number), 0) + 1 AS next FROM orders WHERE business_id = ?",
            )
            .bind(businessId)
            .first<{ next: number }>()
        return row?.next ?? 1
    }

    async insert(order: Order): Promise<OrderInsert> {
        const values = orderValues(order)
        const statements = [
            this.db
                .prepare(`INSERT INTO orders (${COLUMNS}) VALUES (${placeholders(values.length)})`)
                .bind(...values),
            ...order.items.map((item, line) =>
                this.db
                    .prepare(
                        `INSERT INTO order_items (${ITEM_COLUMNS}, total)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    )
                    .bind(
                        order.id,
                        line,
                        item.productId,
                        item.name,
                        item.unit,
                        item.category,
                        item.unitPrice.amount,
                        item.quantity,
                        item.options ? JSON.stringify(item.options) : null,
                        item.fromStock ? 1 : null,
                        item.total.amount,
                    ),
            ),
            ...order
                .stockTaken()
                .map(({ productId, quantity }) =>
                    this.db.prepare(STOCK_TAKE_SQL).bind(quantity, productId, order.businessId),
                ),
            ...(order.sourceLinkId === undefined
                ? []
                : [this.db.prepare(LINK_ORDER_SQL).bind(order.sourceLinkId, order.businessId)]),
        ]
        try {
            await this.db.batch(statements)
            written.set(order, mutableValues(order))
            versions.remember(order, order.updatedAt.getTime())
            return "placed"
        } catch (error) {
            if (isUniqueViolation(error)) {
                return "number_taken"
            }
            if (isStockShortage(error)) {
                return "out_of_stock"
            }
            throw error
        }
    }

    /**
     * Writes only over the version this copy was loaded with (a newer change wins, 409 here), and
     * only the columns that changed since it was loaded.
     */
    async save(order: Order): Promise<void> {
        const save = orderSaveStatement(this.db, order)
        const also = [
            ...this.restockOnCancel(order, save.version),
            ...this.removedLines(order, save.version),
            ...this.saleOfLink(order, save.version),
        ]
        const result =
            also.length === 0
                ? await save.statement.run()
                : (await this.db.batch([save.statement, ...also]))[0]
        if (!result || result.meta.changes === 0) {
            throw ConflictError.stale("order", order.id)
        }
        save.saved()
    }

    /**
     * The lines taken out with «Yo'q», marked with this save (a line marked before is left as it
     * is: the statement changes nothing there).
     */
    private removedLines(order: Order, version: number): D1PreparedStatement[] {
        return order
            .lines()
            .flatMap(({ line, item }) =>
                item.removedAt === undefined
                    ? []
                    : [
                          this.db
                              .prepare(LINE_REMOVED_SQL)
                              .bind(item.removedAt.getTime(), order.id, line, order.id, version),
                      ],
            )
    }

    /** The link the order came from counts the sale when this save is the one that delivers it. */
    private saleOfLink(order: Order, version: number): D1PreparedStatement[] {
        const before = written.get(order)?.[MUTABLE_COLUMNS.indexOf("status")]
        if (
            order.sourceLinkId === undefined ||
            order.status !== OrderStatus.DELIVERED ||
            before === OrderStatus.DELIVERED
        ) {
            return []
        }
        return [
            this.db
                .prepare(LINK_SALE_SQL)
                .bind(
                    order.subtotal.amount,
                    order.sourceLinkId,
                    order.businessId,
                    order.id,
                    version,
                ),
        ]
    }

    /** The stock an order gives back when this save is the one that cancels it. */
    private restockOnCancel(order: Order, version: number): D1PreparedStatement[] {
        const before = written.get(order)?.[MUTABLE_COLUMNS.indexOf("status")]
        if (order.status !== OrderStatus.CANCELLED || before === OrderStatus.CANCELLED) {
            return []
        }
        return order
            .stockTaken()
            .map(({ productId, quantity }) =>
                this.db
                    .prepare(STOCK_RETURN_SQL)
                    .bind(quantity, productId, order.businessId, order.id, version),
            )
    }

    /** One statement with the condition: of two «Беру» at the same moment, one changes a row. */
    async claimForNetwork(order: Order): Promise<boolean> {
        const result = await this.db
            .prepare(
                `UPDATE orders SET courier_id = ?, courier_name = ?, courier_phone = ?,
                    delivery_fee_to = ?, updated_at = MAX(?, updated_at + 1)
                 WHERE id = ? AND courier_id IS NULL AND network_requested_at IS NOT NULL
                    AND status IN (${placeholders(TAKEABLE.length)})`,
            )
            .bind(
                order.courierId ?? null,
                order.courierName ?? null,
                order.courierPhone?.number ?? null,
                order.deliveryFeeTo,
                order.updatedAt.getTime(),
                order.id,
                ...TAKEABLE,
            )
            .run()
        return result.meta.changes === 1
    }

    async findReceiptReuse(input: {
        hash: string
        orderId: string
        businessId: string
        customerId: string
    }): Promise<number | undefined> {
        const row = await this.db
            .prepare(RECEIPT_REUSE_SQL)
            .bind(input.hash, input.orderId, input.businessId, input.customerId)
            .first<{ business_id: string; number: number }>()
        if (!row) {
            return undefined
        }
        return row.business_id === input.businessId ? row.number : 0
    }

    async countTransferRejections(customerId: string, exceptOrderId: string): Promise<number> {
        const row = await this.db
            .prepare(TRANSFER_REJECTIONS_SQL)
            .bind(customerId, exceptOrderId)
            .first<{ total: number }>()
        return row?.total ?? 0
    }

    async markNetworkAlerted(orderId: string, at: Date): Promise<boolean> {
        const result = await this.db
            .prepare(
                `UPDATE orders SET network_alerted_at = ?1, updated_at = MAX(?1, updated_at + 1)
                 WHERE id = ? AND network_alerted_at IS NULL AND network_requested_at IS NOT NULL
                    AND courier_id IS NULL AND status IN (${placeholders(TAKEABLE.length)})`,
            )
            .bind(at.getTime(), orderId, ...TAKEABLE)
            .run()
        return result.meta.changes === 1
    }

    async listWaitingForNetwork(
        districtIds: readonly string[],
        limit: number,
        options: { unalerted?: boolean } = {},
    ): Promise<Order[]> {
        if (districtIds.length === 0) {
            return []
        }
        const { results } = await this.db
            .prepare(networkWaitingSql(districtIds.length, options.unalerted ?? false))
            .bind(...districtIds, limit)
            .all<OrderRow>()
        const items = await this.itemsFor(results.map((o) => o.id))
        return results.map((row) => toOrder(row, items.get(row.id) ?? []))
    }

    async deleteAllOfBusiness(businessId: string): Promise<void> {
        const ofShop = "SELECT id FROM orders WHERE business_id = ?"
        await this.db.batch([
            this.db
                .prepare(`DELETE FROM order_items WHERE order_id IN (${ofShop})`)
                .bind(businessId),
            this.db
                .prepare(`DELETE FROM network_offers WHERE order_id IN (${ofShop})`)
                .bind(businessId),
            this.db.prepare("DELETE FROM orders WHERE business_id = ?").bind(businessId),
            this.db.prepare("DELETE FROM trips WHERE business_id = ?").bind(businessId),
        ])
    }

    async networkShare(districtId: string, from: Date, to: Date): Promise<NetworkShare> {
        const row = await this.db
            .prepare(
                `SELECT COUNT(*) AS delivered,
                    COALESCE(SUM(network_requested_at IS NOT NULL AND courier_id IS NOT NULL), 0)
                        AS viaNetwork
                 FROM orders
                 WHERE status = 'delivered' AND delivered_at >= ? AND delivered_at < ?
                    AND business_id IN (SELECT id FROM businesses WHERE district_id = ?)`,
            )
            .bind(from.getTime(), to.getTime(), districtId)
            .first<NetworkShare>()
        return { delivered: row?.delivered ?? 0, viaNetwork: row?.viaNetwork ?? 0 }
    }

    async listByBusiness(
        businessId: string,
        statuses: readonly OrderStatus[] | undefined,
        page: PageRequest,
    ): Promise<Page<Order>> {
        if (statuses === undefined) {
            return this.page("orders", "business_id = ?", [businessId], page)
        }
        return this.page(
            BY_STATUS,
            shopStatusWhere(statuses.length),
            [businessId, ...statuses],
            page,
        )
    }

    async activeVersion(businessId: string): Promise<string> {
        const row = await this.db
            .prepare(ACTIVE_VERSION_SQL)
            .bind(businessId, ...ACTIVE_ORDER_STATUSES)
            .first<{ open: number; latest: number | null }>()
        return `${row?.open ?? 0}:${row?.latest ?? 0}`
    }

    async listByCourier(courierId: string, since: Date): Promise<Order[]> {
        const { results } = await this.db
            .prepare(COURIER_ORDERS_SQL)
            .bind(...courierOrdersBinds(courierId, since))
            .all<OrderRow>()
        const items = await this.itemsFor(results.map((o) => o.id))
        return results.map((row) => toOrder(row, items.get(row.id) ?? []))
    }

    async listByCustomer(
        customerId: string,
        businessId: string,
        page: PageRequest,
    ): Promise<Page<Order>> {
        return this.page(
            "orders",
            "customer_id = ? AND business_id = ?",
            [customerId, businessId],
            page,
        )
    }

    /** Counts by creation time; money of delivered orders by delivery time. Two scans. */
    async moneyTotals(businessId: string, from: Date, to: Date): Promise<MoneyTotals> {
        const range = [businessId, from.getTime(), to.getTime()]
        const [counts, money] = await this.db.batch([
            this.db
                .prepare(
                    `SELECT COALESCE(SUM(status != 'cancelled'), 0) AS placed,
                        COALESCE(SUM(status = 'cancelled'), 0) AS cancelled
                     FROM orders WHERE business_id = ? AND created_at >= ? AND created_at < ?`,
                )
                .bind(...range),
            this.db
                .prepare(
                    `SELECT COUNT(*) AS delivered,
                        COALESCE(SUM(subtotal), 0) AS goods,
                        COALESCE(SUM(delivery_fee), 0) AS delivery,
                        COALESCE(SUM(deposit_total), 0) AS deposits,
                        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total END), 0) AS paid,
                        COALESCE(SUM(CASE WHEN payment_status = 'paid'
                            AND payment_method = 'cash' THEN total END), 0) AS paidCash,
                        COALESCE(SUM(commission), 0) AS commission
                     FROM orders
                     WHERE business_id = ? AND status = 'delivered'
                        AND delivered_at >= ? AND delivered_at < ?`,
                )
                .bind(...range),
        ])
        // Every column is COALESCEd in SQL: the rows always carry numbers.
        return {
            ...EMPTY_TOTALS,
            ...(counts?.results[0] as Partial<MoneyTotals> | undefined),
            ...(money?.results[0] as Partial<MoneyTotals> | undefined),
        }
    }

    async listOpenPayments(businessId: string, limit: number): Promise<Order[]> {
        const [open, owed] = await Promise.all([
            this.list(OPEN_PAYMENTS_FROM, OPEN_PAYMENTS_WHERE, [businessId], "number ASC", limit),
            this.list(REFUND_OWED_FROM, REFUND_OWED_WHERE, [businessId], "number ASC", limit),
        ])
        // A cancelled order may be in both: refund due, with a part owed from before.
        const byId = new Map([...open, ...owed].map((order) => [order.id, order]))
        return [...byId.values()].sort((a, b) => a.number - b.number).slice(0, limit)
    }

    async listCashWithCouriers(businessId: string, limit: number): Promise<Order[]> {
        return this.list(CASH_OPEN_FROM, CASH_OPEN_WHERE, [businessId], "number ASC", limit)
    }

    async cashHeldBy(courierId: string): Promise<number> {
        const row = await this.db
            .prepare(
                `SELECT COALESCE(SUM(total), 0) AS held FROM orders
                 WHERE cash_courier_id = ? AND ${WITH_COURIER}`,
            )
            .bind(courierId)
            .first<{ held: number }>()
        return row?.held ?? 0
    }

    async listCreatedBetween(
        businessId: string,
        from: Date,
        to: Date,
        limit: number,
    ): Promise<Order[]> {
        return this.list(
            "orders",
            "business_id = ? AND created_at >= ? AND created_at < ?",
            [businessId, from.getTime(), to.getTime()],
            "number ASC",
            limit,
        )
    }

    /**
     * Telegram message id of an order card, to edit it on status change. The owner's card says
     * which bot holds it (`via`): an edit goes to that bot.
     */
    async setMessageId(
        orderId: string,
        holder: OrderCardHolder,
        messageId: number,
        via: OwnerCardBot = "shop",
    ): Promise<void> {
        if (holder === "owner") {
            await this.db
                .prepare(
                    "UPDATE orders SET owner_message_id = ?, owner_message_via = ? WHERE id = ?",
                )
                .bind(messageId, via, orderId)
                .run()
            return
        }
        await this.db
            .prepare(`UPDATE orders SET ${MESSAGE_COLUMNS[holder]} = ? WHERE id = ?`)
            .bind(messageId, orderId)
            .run()
    }

    async getMessageIds(orderId: string): Promise<OrderMessages> {
        const row = await this.db
            .prepare(
                `SELECT owner_message_id, owner_message_via, courier_message_id, customer_message_id
                 FROM orders WHERE id = ?`,
            )
            .bind(orderId)
            .first<{
                owner_message_id: number | null
                owner_message_via: string | null
                courier_message_id: number | null
                customer_message_id: number | null
            }>()
        return {
            owner: row?.owner_message_id ?? null,
            ownerVia: row?.owner_message_via === "business" ? "business" : "shop",
            courier: row?.courier_message_id ?? null,
            customer: row?.customer_message_id ?? null,
        }
    }

    private async list(
        from: string,
        where: string,
        params: (string | number)[],
        order: string,
        limit: number,
    ): Promise<Order[]> {
        const { results } = await this.db
            .prepare(`SELECT ${COLUMNS} FROM ${from} WHERE ${where} ORDER BY ${order} LIMIT ?`)
            .bind(...params, limit)
            .all<OrderRow>()
        const items = await this.itemsFor(results.map((o) => o.id))
        return results.map((row) => toOrder(row, items.get(row.id) ?? []))
    }

    /**
     * One page, newest first. Nothing is counted (a shop's or a customer's whole history would be
     * read, and the free plan counts rows read): one row more says whether more follow, so
     * `total` is a lower bound, all the app needs for «Yana».
     */
    private async page(
        from: string,
        where: string,
        params: (string | number)[],
        page: PageRequest,
    ): Promise<Page<Order>> {
        const offset = offsetOf(page)
        const fetched = (
            await this.db
                .prepare(pageSql(from, where))
                .bind(...params, page.limit + 1, offset)
                .all<OrderRow>()
        ).results
        const orders = fetched.slice(0, page.limit)
        const total = offset + orders.length + (fetched.length > page.limit ? 1 : 0)
        const items = await this.itemsFor(orders.map((o) => o.id))
        return {
            data: orders.map((row) => toOrder(row, items.get(row.id) ?? [])),
            meta: { page: page.page, limit: page.limit, total },
        }
    }

    private async itemsFor(orderIds: string[]): Promise<Map<string, ItemRow[]>> {
        const byOrder = new Map<string, ItemRow[]>()
        if (orderIds.length === 0) {
            return byOrder
        }
        // D1 binds at most 100 values per statement: the month's export has thousands of orders.
        const statements: D1PreparedStatement[] = []
        for (let start = 0; start < orderIds.length; start += IN_CHUNK) {
            const chunk = orderIds.slice(start, start + IN_CHUNK)
            statements.push(
                this.db
                    .prepare(
                        `SELECT ${ITEM_READ_COLUMNS} FROM order_items
                         WHERE order_id IN (${placeholders(chunk.length)})`,
                    )
                    .bind(...chunk),
            )
        }
        for (const { results } of await this.db.batch<ItemRow>(statements)) {
            for (const item of results) {
                byOrder.set(item.order_id, [...(byOrder.get(item.order_id) ?? []), item])
            }
        }
        return byOrder
    }
}

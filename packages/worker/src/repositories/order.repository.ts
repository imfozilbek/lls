import {
    ACTIVE_ORDER_STATUSES,
    CATEGORIES,
    Location,
    Money,
    ORDER_CHANNELS,
    ORDER_STATUSES,
    Order,
    OrderItem,
    OrderStatus,
    Phone,
    UNITS,
    offsetOf,
} from "@lls/core"

import { isUniqueViolation, oneOf, optional, placeholders } from "./rows.js"

import type { CancelledBy, OrderRepository, OrderStatsDTO, Page, PageRequest } from "@lls/core"

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
    address: string
    landmark: string | null
    latitude: number | null
    longitude: number | null
    comment: string | null
    customer_name: string
    customer_phone: string | null
    cancel_reason: string | null
    cancelled_by: string | null
    created_at: number
    updated_at: number
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
}

/** Who gets a Telegram card for an order; each card is edited in place on status changes. */
export type OrderCardHolder = "owner" | "courier"

const COLUMNS = `id, business_id, number, customer_id, channel, status, subtotal, delivery_fee,
    deposit_total, bottles_returned, total, commission_bps, commission, courier_id, courier_name,
    address, landmark, latitude, longitude, comment, customer_name, customer_phone,
    cancel_reason, cancelled_by, created_at, updated_at`

const ITEM_COLUMNS = "order_id, line, product_id, name, unit, category, unit_price, quantity"

const CANCELLED_BY: readonly CancelledBy[] = ["customer", "owner"]

/** Most a courier's screen shows at once: today's work fits easily. */
const COURIER_LIST_LIMIT = 50

function toItem(row: ItemRow): OrderItem {
    return OrderItem.create({
        productId: row.product_id,
        name: row.name,
        unit: oneOf(row.unit, UNITS, "unit"),
        category: oneOf(row.category, CATEGORIES, "category"),
        unitPrice: Money.of(row.unit_price),
        quantity: row.quantity,
    })
}

function toOrder(row: OrderRow, items: ItemRow[]): Order {
    return Order.reconstitute({
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
        address: row.address,
        landmark: optional(row.landmark),
        location:
            row.latitude === null || row.longitude === null
                ? undefined
                : Location.create(row.latitude, row.longitude),
        comment: optional(row.comment),
        customerName: row.customer_name,
        customerPhone: row.customer_phone === null ? undefined : Phone.create(row.customer_phone),
        cancelReason: optional(row.cancel_reason),
        cancelledBy:
            row.cancelled_by === null
                ? undefined
                : oneOf(row.cancelled_by, CANCELLED_BY, "cancelled_by"),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    })
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
        order.address,
        order.landmark ?? null,
        order.location?.latitude ?? null,
        order.location?.longitude ?? null,
        order.comment ?? null,
        order.customerName,
        order.customerPhone?.number ?? null,
        order.cancelReason ?? null,
        order.cancelledBy ?? null,
        order.createdAt.getTime(),
        order.updatedAt.getTime(),
    ]
}

export class D1OrderRepository implements OrderRepository {
    constructor(private readonly db: D1Database) {}

    async findById(id: string): Promise<Order | null> {
        const [orders, items] = await this.db.batch([
            this.db.prepare(`SELECT ${COLUMNS} FROM orders WHERE id = ?`).bind(id),
            this.db.prepare(`SELECT ${ITEM_COLUMNS} FROM order_items WHERE order_id = ?`).bind(id),
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

    async insert(order: Order): Promise<boolean> {
        const values = orderValues(order)
        const statements = [
            this.db
                .prepare(`INSERT INTO orders (${COLUMNS}) VALUES (${placeholders(values.length)})`)
                .bind(...values),
            ...order.items.map((item, line) =>
                this.db
                    .prepare(
                        `INSERT INTO order_items (${ITEM_COLUMNS}, total)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                        item.total.amount,
                    ),
            ),
        ]
        try {
            await this.db.batch(statements)
            return true
        } catch (error) {
            if (isUniqueViolation(error)) {
                return false
            }
            throw error
        }
    }

    async save(order: Order): Promise<void> {
        await this.db
            .prepare(
                `UPDATE orders SET status = ?, courier_id = ?, courier_name = ?, cancel_reason = ?,
                    cancelled_by = ?, updated_at = ?
                 WHERE id = ?`,
            )
            .bind(
                order.status,
                order.courierId ?? null,
                order.courierName ?? null,
                order.cancelReason ?? null,
                order.cancelledBy ?? null,
                order.updatedAt.getTime(),
                order.id,
            )
            .run()
    }

    async listByBusiness(
        businessId: string,
        statuses: readonly OrderStatus[] | undefined,
        page: PageRequest,
    ): Promise<Page<Order>> {
        const filter =
            statuses === undefined ? "" : ` AND status IN (${placeholders(statuses.length)})`
        return this.page(`business_id = ?${filter}`, [businessId, ...(statuses ?? [])], page)
    }

    async listByCourier(courierId: string, since: Date): Promise<Order[]> {
        const active = placeholders(ACTIVE_ORDER_STATUSES.length)
        const { results } = await this.db
            .prepare(
                `SELECT ${COLUMNS} FROM orders
                 WHERE courier_id = ? AND (status IN (${active}) OR updated_at >= ?)
                 ORDER BY number DESC LIMIT ?`,
            )
            .bind(courierId, ...ACTIVE_ORDER_STATUSES, since.getTime(), COURIER_LIST_LIMIT)
            .all<OrderRow>()
        const items = await this.itemsFor(results.map((o) => o.id))
        return results.map((row) => toOrder(row, items.get(row.id) ?? []))
    }

    async listByCustomer(
        customerId: string,
        businessId: string,
        page: PageRequest,
    ): Promise<Page<Order>> {
        return this.page("customer_id = ? AND business_id = ?", [customerId, businessId], page)
    }

    /** Revenue = delivered orders without bottle deposits (a deposit is returned money). */
    async stats(businessId: string, from: Date, to: Date): Promise<OrderStatsDTO> {
        const row = await this.db
            .prepare(
                `SELECT
                    COALESCE(SUM(status != ?), 0) AS orders,
                    COALESCE(SUM(status = ?), 0) AS delivered,
                    COALESCE(SUM(status = ?), 0) AS cancelled,
                    COALESCE(SUM(CASE WHEN status = ? THEN total - deposit_total ELSE 0 END), 0)
                        AS revenue
                 FROM orders WHERE business_id = ? AND created_at >= ? AND created_at < ?`,
            )
            .bind(
                OrderStatus.CANCELLED,
                OrderStatus.DELIVERED,
                OrderStatus.CANCELLED,
                OrderStatus.DELIVERED,
                businessId,
                from.getTime(),
                to.getTime(),
            )
            .first<OrderStatsDTO>()
        return row ?? { orders: 0, delivered: 0, cancelled: 0, revenue: 0 }
    }

    /** Telegram message id of an order card, to edit it on status change. */
    async setMessageId(orderId: string, holder: OrderCardHolder, messageId: number): Promise<void> {
        const column = holder === "owner" ? "owner_message_id" : "courier_message_id"
        await this.db
            .prepare(`UPDATE orders SET ${column} = ? WHERE id = ?`)
            .bind(messageId, orderId)
            .run()
    }

    async getMessageIds(
        orderId: string,
    ): Promise<{ owner: number | null; courier: number | null }> {
        const row = await this.db
            .prepare("SELECT owner_message_id, courier_message_id FROM orders WHERE id = ?")
            .bind(orderId)
            .first<{ owner_message_id: number | null; courier_message_id: number | null }>()
        return { owner: row?.owner_message_id ?? null, courier: row?.courier_message_id ?? null }
    }

    private async page(
        where: string,
        params: (string | number)[],
        page: PageRequest,
    ): Promise<Page<Order>> {
        const [rows, count] = await this.db.batch([
            this.db
                .prepare(
                    `SELECT ${COLUMNS} FROM orders WHERE ${where}
                     ORDER BY number DESC LIMIT ? OFFSET ?`,
                )
                .bind(...params, page.limit, offsetOf(page)),
            this.db.prepare(`SELECT COUNT(*) AS total FROM orders WHERE ${where}`).bind(...params),
        ])
        const orders = (rows?.results ?? []) as OrderRow[]
        const total = (count?.results[0] as { total: number } | undefined)?.total ?? 0
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
        const { results } = await this.db
            .prepare(
                `SELECT ${ITEM_COLUMNS} FROM order_items
                 WHERE order_id IN (${placeholders(orderIds.length)})`,
            )
            .bind(...orderIds)
            .all<ItemRow>()
        for (const item of results) {
            byOrder.set(item.order_id, [...(byOrder.get(item.order_id) ?? []), item])
        }
        return byOrder
    }
}

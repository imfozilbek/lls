import {
    Location,
    Money,
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
    status: string
    subtotal: number
    delivery_fee: number
    total: number
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
    unit_price: number
    quantity: number
}

const COLUMNS = `id, business_id, number, customer_id, status, subtotal, delivery_fee, total,
    address, landmark, latitude, longitude, comment, customer_name, customer_phone,
    cancel_reason, cancelled_by, created_at, updated_at`

const CANCELLED_BY: readonly CancelledBy[] = ["customer", "owner"]

function toItem(row: ItemRow): OrderItem {
    return OrderItem.create({
        productId: row.product_id,
        name: row.name,
        unit: oneOf(row.unit, UNITS, "unit"),
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
        items: items.sort((a, b) => a.line - b.line).map(toItem),
        subtotal: Money.of(row.subtotal),
        deliveryFee: Money.of(row.delivery_fee),
        total: Money.of(row.total),
        status: oneOf(row.status, ORDER_STATUSES, "order status"),
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

export class D1OrderRepository implements OrderRepository {
    constructor(private readonly db: D1Database) {}

    async findById(id: string): Promise<Order | null> {
        const [orders, items] = await this.db.batch([
            this.db.prepare(`SELECT ${COLUMNS} FROM orders WHERE id = ?`).bind(id),
            this.db.prepare("SELECT * FROM order_items WHERE order_id = ?").bind(id),
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
        const statements = [
            this.db
                .prepare(
                    `INSERT INTO orders (${COLUMNS})
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .bind(
                    order.id,
                    order.businessId,
                    order.number,
                    order.customerId,
                    order.status,
                    order.subtotal.amount,
                    order.deliveryFee.amount,
                    order.total.amount,
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
                ),
            ...order.items.map((item, line) =>
                this.db
                    .prepare(
                        `INSERT INTO order_items
                            (order_id, line, product_id, name, unit, unit_price, quantity)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    )
                    .bind(
                        order.id,
                        line,
                        item.productId,
                        item.name,
                        item.unit,
                        item.unitPrice.amount,
                        item.quantity,
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
                `UPDATE orders SET status = ?, cancel_reason = ?, cancelled_by = ?, updated_at = ?
                 WHERE id = ?`,
            )
            .bind(
                order.status,
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

    async listByCustomer(
        customerId: string,
        businessId: string,
        page: PageRequest,
    ): Promise<Page<Order>> {
        return this.page("customer_id = ? AND business_id = ?", [customerId, businessId], page)
    }

    async stats(businessId: string, from: Date, to: Date): Promise<OrderStatsDTO> {
        const row = await this.db
            .prepare(
                `SELECT
                    COALESCE(SUM(status != ?), 0) AS orders,
                    COALESCE(SUM(status = ?), 0) AS delivered,
                    COALESCE(SUM(status = ?), 0) AS cancelled,
                    COALESCE(SUM(CASE WHEN status = ? THEN total ELSE 0 END), 0) AS revenue
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

    /** Telegram message id of the owner notification, to edit it on status change. */
    async setOwnerMessageId(orderId: string, messageId: number): Promise<void> {
        await this.db
            .prepare("UPDATE orders SET owner_message_id = ? WHERE id = ?")
            .bind(messageId, orderId)
            .run()
    }

    async getOwnerMessageId(orderId: string): Promise<number | null> {
        const row = await this.db
            .prepare("SELECT owner_message_id FROM orders WHERE id = ?")
            .bind(orderId)
            .first<{ owner_message_id: number | null }>()
        return row?.owner_message_id ?? null
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
                `SELECT * FROM order_items WHERE order_id IN (${placeholders(orderIds.length)})`,
            )
            .bind(...orderIds)
            .all<ItemRow>()
        for (const item of results) {
            byOrder.set(item.order_id, [...(byOrder.get(item.order_id) ?? []), item])
        }
        return byOrder
    }
}

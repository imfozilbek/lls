import { offsetOf } from "../application/dtos/pagination.js"
import { ACTIVE_ORDER_STATUSES, OrderStatus } from "../domain/enums/order-status.js"

import type { Page, PageRequest } from "../application/dtos/pagination.js"
import type { OrderStatsDTO } from "../application/dtos/stats.dto.js"
import type { BusinessRepository } from "../application/ports/business-repository.js"
import type { Clock } from "../application/ports/clock.js"
import type { CourierRepository } from "../application/ports/courier-repository.js"
import type { CustomerRepository } from "../application/ports/customer-repository.js"
import type { OrderRepository } from "../application/ports/order-repository.js"
import type {
    ProductListQuery,
    ProductRepository,
    ShowcaseSearch,
} from "../application/ports/product-repository.js"
import type { Business } from "../domain/entities/business.js"
import type { Courier, CourierInvite } from "../domain/entities/courier.js"
import type { Customer } from "../domain/entities/customer.js"
import type { Order } from "../domain/entities/order.js"
import type { Product } from "../domain/entities/product.js"

function paginate<T>(items: T[], request: PageRequest): Page<T> {
    const start = offsetOf(request)
    return {
        data: items.slice(start, start + request.limit),
        meta: { page: request.page, limit: request.limit, total: items.length },
    }
}

export class InMemoryBusinesses implements BusinessRepository {
    readonly items = new Map<string, Business>()
    readonly tokens = new Map<string, string>()

    async findById(id: string): Promise<Business | null> {
        return this.items.get(id) ?? null
    }
    async findBySlug(slug: string): Promise<Business | null> {
        return [...this.items.values()].find((b) => b.slug.value === slug) ?? null
    }
    async findByBotId(botId: number): Promise<Business | null> {
        return [...this.items.values()].find((b) => b.bot.id === botId) ?? null
    }
    async listByOwner(ownerTelegramId: number): Promise<Business[]> {
        return [...this.items.values()].filter((b) => b.isOwnedBy(ownerTelegramId))
    }
    async listInShowcase(): Promise<Business[]> {
        return [...this.items.values()].filter((b) => b.isInShowcase())
    }
    async insert(business: Business, botToken: string): Promise<void> {
        this.items.set(business.id, business)
        this.tokens.set(business.id, botToken)
    }
    async save(business: Business): Promise<void> {
        this.items.set(business.id, business)
    }
}

export class InMemoryProducts implements ProductRepository {
    readonly items = new Map<string, Product>()

    constructor(private readonly businesses?: InMemoryBusinesses) {}

    async findById(id: string): Promise<Product | null> {
        return this.items.get(id) ?? null
    }
    async findByIds(businessId: string, ids: readonly string[]): Promise<Product[]> {
        return ids
            .map((id) => this.items.get(id))
            .filter((p): p is Product => p !== undefined && p.belongsTo(businessId))
    }
    async list(
        businessId: string,
        query: ProductListQuery,
        page: PageRequest,
    ): Promise<Page<Product>> {
        const matching = [...this.items.values()]
            .filter((p) => p.belongsTo(businessId))
            .filter((p) => query.availableAt === undefined || p.isAvailableAt(query.availableAt))
            .filter((p) => query.category === undefined || p.category === query.category)
            .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
        return paginate(matching, page)
    }
    async searchShowcase(search: ShowcaseSearch, page: PageRequest): Promise<Page<Product>> {
        const shops = new Set((await this.businesses?.listInShowcase())?.map((b) => b.id))
        const matching = [...this.items.values()]
            .filter((p) => shops.has(p.businessId) && p.isAvailableAt(search.availableAt))
            .filter((p) => search.category === undefined || p.category === search.category)
            .filter((p) => search.words.every((word) => p.searchText.includes(word)))
            .sort((a, b) => a.name.localeCompare(b.name))
        return paginate(matching, page)
    }
    async save(product: Product): Promise<void> {
        this.items.set(product.id, product)
    }
    async delete(id: string): Promise<void> {
        this.items.delete(id)
    }
}

export class InMemoryCustomers implements CustomerRepository {
    readonly items = new Map<string, Customer>()
    readonly links = new Map<string, Date>()

    async findById(id: string): Promise<Customer | null> {
        return this.items.get(id) ?? null
    }
    async findByTelegramId(telegramId: number): Promise<Customer | null> {
        return [...this.items.values()].find((c) => c.telegramId.value === telegramId) ?? null
    }
    async save(customer: Customer): Promise<void> {
        this.items.set(customer.id, customer)
    }
    async linkToBusiness(customerId: string, businessId: string, at: Date): Promise<void> {
        const key = `${customerId}:${businessId}`
        if (!this.links.has(key)) {
            this.links.set(key, at)
        }
    }
}

export class InMemoryOrders implements OrderRepository {
    readonly items = new Map<string, Order>()
    /** Simulate a concurrent insert taking the next number this many times. */
    collisions = 0

    async findById(id: string): Promise<Order | null> {
        return this.items.get(id) ?? null
    }
    async nextNumber(businessId: string): Promise<number> {
        const numbers = [...this.items.values()]
            .filter((o) => o.businessId === businessId)
            .map((o) => o.number)
        return Math.max(0, ...numbers) + 1
    }
    async insert(order: Order): Promise<boolean> {
        if (this.collisions > 0) {
            this.collisions--
            return false
        }
        this.items.set(order.id, order)
        return true
    }
    async save(order: Order): Promise<void> {
        this.items.set(order.id, order)
    }
    async listByBusiness(
        businessId: string,
        statuses: readonly OrderStatus[] | undefined,
        page: PageRequest,
    ): Promise<Page<Order>> {
        const matching = [...this.items.values()]
            .filter((o) => o.businessId === businessId)
            .filter((o) => statuses === undefined || statuses.includes(o.status))
            .sort((a, b) => b.number - a.number)
        return paginate(matching, page)
    }
    async listByCourier(courierId: string, since: Date): Promise<Order[]> {
        return [...this.items.values()]
            .filter((o) => o.courierId === courierId)
            .filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status) || o.updatedAt >= since)
            .sort((a, b) => b.number - a.number)
    }
    async listByCustomer(
        customerId: string,
        businessId: string,
        page: PageRequest,
    ): Promise<Page<Order>> {
        const matching = [...this.items.values()]
            .filter((o) => o.customerId === customerId && o.businessId === businessId)
            .sort((a, b) => b.number - a.number)
        return paginate(matching, page)
    }
    async stats(businessId: string, from: Date, to: Date): Promise<OrderStatsDTO> {
        const inRange = [...this.items.values()].filter(
            (o) => o.businessId === businessId && o.createdAt >= from && o.createdAt < to,
        )
        const delivered = inRange.filter((o) => o.status === OrderStatus.DELIVERED)
        return {
            orders: inRange.filter((o) => o.status !== OrderStatus.CANCELLED).length,
            delivered: delivered.length,
            cancelled: inRange.filter((o) => o.status === OrderStatus.CANCELLED).length,
            revenue: delivered.reduce((sum, o) => sum + o.total.amount, 0),
        }
    }
}

export function fixedClock(date: Date): Clock {
    return { now: () => date }
}

export class InMemoryCouriers implements CourierRepository {
    readonly items = new Map<string, Courier>()
    readonly invites = new Map<string, CourierInvite>()

    async findById(id: string): Promise<Courier | null> {
        return this.items.get(id) ?? null
    }
    async findByTelegramId(businessId: string, telegramId: number): Promise<Courier | null> {
        return (
            [...this.items.values()].find(
                (c) => c.businessId === businessId && c.telegramId.value === telegramId,
            ) ?? null
        )
    }
    async listActive(businessId: string): Promise<Courier[]> {
        return [...this.items.values()].filter((c) => c.worksFor(businessId))
    }
    async save(courier: Courier): Promise<void> {
        this.items.set(courier.id, courier)
    }
    async saveInvite(invite: CourierInvite): Promise<void> {
        this.invites.set(invite.code, invite)
    }
    async findInvite(code: string): Promise<CourierInvite | null> {
        return this.invites.get(code) ?? null
    }
}

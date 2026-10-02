import { offsetOf } from "../application/dtos/pagination.js"
import { CourierStatus } from "../domain/enums/courier-status.js"
import { ACTIVE_ORDER_STATUSES, OrderStatus } from "../domain/enums/order-status.js"
import { PaymentMethod, PaymentStatus } from "../domain/enums/payment.js"

import type { Page, PageRequest } from "../application/dtos/pagination.js"
import type { BusinessRepository } from "../application/ports/business-repository.js"
import type {
    CashHandoverRepository,
    CourierAmount,
} from "../application/ports/cash-handover-repository.js"
import type { Clock } from "../application/ports/clock.js"
import type { CourierRepository } from "../application/ports/courier-repository.js"
import type { CustomerRepository } from "../application/ports/customer-repository.js"
import type { MoneyTotals, OrderRepository } from "../application/ports/order-repository.js"
import type {
    ProductListQuery,
    ProductRepository,
    ShowcaseSearch,
} from "../application/ports/product-repository.js"
import type { Business } from "../domain/entities/business.js"
import type { CashHandover } from "../domain/entities/cash-handover.js"
import type { Courier, CourierInvite } from "../domain/entities/courier.js"
import type { CourierProfile } from "../domain/entities/courier-profile.js"
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
            .filter((p) => search.words.every((word) => ` ${p.searchText}`.includes(` ${word}`)))
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
    readonly phoneShares = new Map<string, Date>()

    async hasSharedPhoneWith(customerId: string, businessId: string): Promise<boolean> {
        return this.phoneShares.has(`${customerId}:${businessId}`)
    }
    async sharePhoneWith(customerId: string, businessId: string, at: Date): Promise<void> {
        const key = `${customerId}:${businessId}`
        if (!this.phoneShares.has(key)) {
            this.phoneShares.set(key, at)
        }
    }

    async findById(id: string): Promise<Customer | null> {
        return this.items.get(id) ?? null
    }
    async findByTelegramId(telegramId: number): Promise<Customer | null> {
        return [...this.items.values()].find((c) => c.telegramId.value === telegramId) ?? null
    }
    async save(customer: Customer): Promise<void> {
        this.items.set(customer.id, customer)
    }
    /** Simulates another request that registered the same person a moment earlier. */
    registeredMeanwhile: Customer | null = null
    async register(customer: Customer): Promise<Customer> {
        if (this.registeredMeanwhile) {
            this.items.set(this.registeredMeanwhile.id, this.registeredMeanwhile)
            this.registeredMeanwhile = null
        }
        const existing = await this.findByTelegramId(customer.telegramId.value)
        if (existing) {
            return existing
        }
        this.items.set(customer.id, customer)
        return customer
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
    async moneyTotals(businessId: string, from: Date, to: Date): Promise<MoneyTotals> {
        const mine = [...this.items.values()].filter((o) => o.businessId === businessId)
        const created = mine.filter((o) => o.createdAt >= from && o.createdAt < to)
        const delivered = mine.filter(
            (o) =>
                o.status === OrderStatus.DELIVERED &&
                o.deliveredAt !== undefined &&
                o.deliveredAt >= from &&
                o.deliveredAt < to,
        )
        const sum = (list: Order[], pick: (o: Order) => number): number =>
            list.reduce((total, o) => total + pick(o), 0)
        const paidBy = (method: PaymentMethod): Order[] =>
            delivered.filter(
                (o) => o.payment.status === PaymentStatus.PAID && o.payment.method === method,
            )
        const withStatus = (status: PaymentStatus): Order[] =>
            delivered.filter((o) => o.payment.status === status)
        return {
            placed: created.filter((o) => o.status !== OrderStatus.CANCELLED).length,
            delivered: delivered.length,
            cancelled: created.filter((o) => o.status === OrderStatus.CANCELLED).length,
            goods: sum(delivered, (o) => o.subtotal.amount),
            delivery: sum(delivered, (o) => o.deliveryFee.amount),
            deposits: sum(delivered, (o) => o.depositTotal.amount),
            paidCash: sum(paidBy(PaymentMethod.CASH), (o) => o.total.amount),
            paidCard: sum(paidBy(PaymentMethod.CARD_TRANSFER), (o) => o.total.amount),
            awaiting: sum(withStatus(PaymentStatus.AWAITING), (o) => o.total.amount),
            debt: sum(withStatus(PaymentStatus.UNPAID), (o) => o.total.amount),
            commission: sum(delivered, (o) => o.commission.amount),
        }
    }
    async listOpenPayments(businessId: string, limit: number): Promise<Order[]> {
        return [...this.items.values()]
            .filter(
                (o) =>
                    o.businessId === businessId &&
                    (o.payment.status === PaymentStatus.AWAITING ||
                        o.payment.status === PaymentStatus.REFUND_DUE ||
                        (o.payment.status === PaymentStatus.UNPAID &&
                            o.status === OrderStatus.DELIVERED)),
            )
            .sort((a, b) => a.number - b.number)
            .slice(0, limit)
    }
    async cashCollectedByCourier(businessId: string): Promise<CourierAmount[]> {
        const totals = new Map<string, number>()
        for (const o of this.items.values()) {
            const courierId = o.payment.cashCourierId
            if (o.businessId === businessId && courierId && o.payment.isPaid()) {
                totals.set(courierId, (totals.get(courierId) ?? 0) + o.total.amount)
            }
        }
        return [...totals].map(([courierId, amount]) => ({ courierId, amount }))
    }
    async listCreatedBetween(
        businessId: string,
        from: Date,
        to: Date,
        limit: number,
    ): Promise<Order[]> {
        return [...this.items.values()]
            .filter((o) => o.businessId === businessId && o.createdAt >= from && o.createdAt < to)
            .sort((a, b) => a.number - b.number)
            .slice(0, limit)
    }
}

export class InMemoryHandovers implements CashHandoverRepository {
    readonly items: CashHandover[] = []

    async insert(handover: CashHandover): Promise<void> {
        this.items.push(handover)
    }
    async totalsByCourier(businessId: string): Promise<CourierAmount[]> {
        const totals = new Map<string, number>()
        for (const h of this.items.filter((x) => x.businessId === businessId)) {
            totals.set(h.courierId, (totals.get(h.courierId) ?? 0) + h.amount.amount)
        }
        return [...totals].map(([courierId, amount]) => ({ courierId, amount }))
    }
}

export function fixedClock(date: Date): Clock {
    return { now: () => date }
}

export class InMemoryCouriers implements CourierRepository {
    readonly items = new Map<string, Courier>()
    readonly profiles = new Map<number, CourierProfile>()
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
    async listByBusiness(businessId: string): Promise<Courier[]> {
        return [...this.items.values()].filter(
            (c) => c.businessId === businessId && c.status !== CourierStatus.REMOVED,
        )
    }
    async listByPerson(telegramId: number): Promise<Courier[]> {
        return [...this.items.values()].filter((c) => c.telegramId.value === telegramId)
    }
    async save(courier: Courier): Promise<void> {
        this.items.set(courier.id, courier)
    }
    /** The same instance every time, as the links hold it: a shift shows on every link. */
    async findProfile(telegramId: number): Promise<CourierProfile | null> {
        return this.profiles.get(telegramId) ?? null
    }
    async saveProfile(profile: CourierProfile): Promise<void> {
        this.profiles.set(profile.telegramId.value, profile)
    }
    async saveInvite(invite: CourierInvite): Promise<void> {
        this.invites.set(invite.code, invite)
    }
    async findInvite(code: string): Promise<CourierInvite | null> {
        return this.invites.get(code) ?? null
    }
}

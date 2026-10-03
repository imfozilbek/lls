import { offsetOf } from "../application/dtos/pagination.js"
import { CourierStatus } from "../domain/enums/courier-status.js"
import { ACTIVE_ORDER_STATUSES, OrderStatus } from "../domain/enums/order-status.js"
import { PaymentStatus } from "../domain/enums/payment.js"

import type { Page, PageRequest } from "../application/dtos/pagination.js"
import type { BusinessRepository } from "../application/ports/business-repository.js"
import type { Clock } from "../application/ports/clock.js"
import type { CourierRepository } from "../application/ports/courier-repository.js"
import type { CustomerRepository } from "../application/ports/customer-repository.js"
import type { DistrictRepository } from "../application/ports/district-repository.js"
import type {
    ManagedBotRecord,
    ManagedBotRepository,
} from "../application/ports/managed-bot-repository.js"
import type { PayoutCardRepository } from "../application/ports/payout-card-repository.js"
import type { MoneyTotals, OrderRepository } from "../application/ports/order-repository.js"
import type {
    ProductListQuery,
    ProductRepository,
    ShowcaseSearch,
} from "../application/ports/product-repository.js"
import type { Business } from "../domain/entities/business.js"
import type { BusinessStatus } from "../domain/enums/business-status.js"
import type { Courier, CourierInvite } from "../domain/entities/courier.js"
import type { CourierProfile } from "../domain/entities/courier-profile.js"
import type { Customer } from "../domain/entities/customer.js"
import type { District } from "../domain/entities/district.js"
import type { Order } from "../domain/entities/order.js"
import type { SavedPayoutCard } from "../domain/entities/payout-card-book.js"
import type { Product } from "../domain/entities/product.js"

function paginate<T>(items: T[], request: PageRequest): Page<T> {
    const start = offsetOf(request)
    return {
        data: items.slice(start, start + request.limit),
        meta: { page: request.page, limit: request.limit, total: items.length },
    }
}

export class InMemoryPayoutCards implements PayoutCardRepository {
    readonly items = new Map<string, SavedPayoutCard[]>()

    async listByBusiness(businessId: string): Promise<SavedPayoutCard[]> {
        return [...(this.items.get(businessId) ?? [])]
    }
    async insert(businessId: string, card: SavedPayoutCard): Promise<void> {
        this.items.set(businessId, [...(this.items.get(businessId) ?? []), card])
    }
    async delete(businessId: string, id: string): Promise<void> {
        const left = (this.items.get(businessId) ?? []).filter((card) => card.id !== id)
        this.items.set(businessId, left)
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
    async listByStatus(status: BusinessStatus, limit: number): Promise<Business[]> {
        return [...this.items.values()]
            .filter((b) => b.status === status)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit)
    }
    async listWithLocation(): Promise<Business[]> {
        return [...this.items.values()].filter((b) => b.location !== undefined)
    }
    async insert(business: Business, botToken: string): Promise<void> {
        this.items.set(business.id, business)
        this.tokens.set(business.id, botToken)
    }
    async save(business: Business): Promise<void> {
        this.items.set(business.id, business)
    }
    async replaceBotToken(businessId: string, botToken: string): Promise<void> {
        this.tokens.set(businessId, botToken)
    }
}

export class InMemoryManagedBots implements ManagedBotRepository {
    readonly items = new Map<number, ManagedBotRecord>()
    readonly tokens = new Map<number, string>()

    async find(botId: number): Promise<ManagedBotRecord | null> {
        const bot = this.items.get(botId)
        return bot ? { ...bot } : null
    }
    async record(bot: ManagedBotRecord, token: string): Promise<void> {
        this.items.set(bot.botId, { ...bot })
        this.tokens.set(bot.botId, token)
    }
    async token(botId: number): Promise<string | null> {
        return this.tokens.get(botId) ?? null
    }
    async listUnclaimed(ownerTelegramId: number): Promise<ManagedBotRecord[]> {
        return [...this.items.values()].filter(
            (bot) => bot.ownerTelegramId === ownerTelegramId && bot.businessId === undefined,
        )
    }
    async claim(botId: number, businessId: string): Promise<void> {
        const bot = this.items.get(botId)
        if (bot) {
            this.items.set(botId, { ...bot, businessId })
        }
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
    async findManyByTelegramIds(telegramIds: readonly number[]): Promise<Customer[]> {
        return [...this.items.values()].filter((c) => telegramIds.includes(c.telegramId.value))
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
    /** Simulate another courier pressing «Беру» first this many times. */
    claimRaces = 0

    /** Districts live on the shops: network queries look them up here. */
    constructor(private readonly businesses?: InMemoryBusinesses) {}

    private districtOf(order: Order): string | undefined {
        return this.businesses?.items.get(order.businessId)?.districtId
    }

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
        return {
            placed: created.filter((o) => o.status !== OrderStatus.CANCELLED).length,
            delivered: delivered.length,
            cancelled: created.filter((o) => o.status === OrderStatus.CANCELLED).length,
            goods: sum(delivered, (o) => o.subtotal.amount),
            delivery: sum(delivered, (o) => o.deliveryFee.amount),
            deposits: sum(delivered, (o) => o.depositTotal.amount),
            paid: sum(
                delivered.filter((o) => o.payment.status === PaymentStatus.PAID),
                (o) => o.total.amount,
            ),
            commission: sum(delivered, (o) => o.commission.amount),
        }
    }
    async listOpenPayments(businessId: string, limit: number): Promise<Order[]> {
        return [...this.items.values()]
            .filter(
                (o) =>
                    o.businessId === businessId &&
                    (o.payment.status === PaymentStatus.AWAITING ||
                        o.payment.status === PaymentStatus.REFUND_DUE),
            )
            .sort((a, b) => a.number - b.number)
            .slice(0, limit)
    }
    async claimForNetwork(order: Order): Promise<boolean> {
        if (this.claimRaces > 0) {
            this.claimRaces--
            return false
        }
        const stored = this.items.get(order.id)
        if (stored && stored !== order && !stored.isWaitingForNetwork()) {
            return false
        }
        this.items.set(order.id, order)
        return true
    }
    async markNetworkAlerted(orderId: string, at: Date): Promise<boolean> {
        const stored = this.items.get(orderId)
        if (!stored || stored.networkAlertedAt || !stored.isWaitingForNetwork()) {
            return false
        }
        stored.markNetworkAlerted(at)
        return true
    }
    async listWaitingForNetwork(districtIds: readonly string[], limit: number): Promise<Order[]> {
        return [...this.items.values()]
            .filter(
                (o) => o.isWaitingForNetwork() && districtIds.includes(this.districtOf(o) ?? ""),
            )
            .sort(
                (a, b) =>
                    (a.networkRequestedAt?.getTime() ?? 0) - (b.networkRequestedAt?.getTime() ?? 0),
            )
            .slice(0, limit)
    }
    async networkShare(
        districtId: string,
        from: Date,
        to: Date,
    ): Promise<{ delivered: number; viaNetwork: number }> {
        const delivered = [...this.items.values()].filter(
            (o) =>
                this.districtOf(o) === districtId &&
                o.status === OrderStatus.DELIVERED &&
                o.deliveredAt !== undefined &&
                o.deliveredAt >= from &&
                o.deliveredAt < to,
        )
        return {
            delivered: delivered.length,
            viaNetwork: delivered.filter((o) => o.isViaNetwork()).length,
        }
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

export function fixedClock(date: Date): Clock {
    return { now: () => date }
}

export class InMemoryCouriers implements CourierRepository {
    readonly items = new Map<string, Courier>()
    readonly profiles = new Map<number, CourierProfile>()
    readonly invites = new Map<string, CourierInvite>()

    /** Network queries need the shops' districts and the orders people carry. */
    constructor(
        private readonly businesses?: InMemoryBusinesses,
        private readonly orders?: InMemoryOrders,
    ) {}

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
            (c) =>
                c.businessId === businessId &&
                (c.status === CourierStatus.PENDING || c.status === CourierStatus.ACTIVE),
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
    async listFreeNetworkCouriers(
        districtId: string,
        now: Date,
        limit: number,
    ): Promise<CourierProfile[]> {
        const links = [...this.items.values()]
        const inDistrict = (c: Courier): boolean =>
            c.isActive && this.businesses?.items.get(c.businessId)?.districtId === districtId
        const busy = (telegramId: number): boolean =>
            [...(this.orders?.items.values() ?? [])].some(
                (o) =>
                    o.isViaNetwork() &&
                    ACTIVE_ORDER_STATUSES.includes(o.status) &&
                    links.some((c) => c.id === o.courierId && c.telegramId.value === telegramId),
            )
        return [...this.profiles.values()]
            .filter((p) => p.inNetwork && p.isOnShift(now))
            .filter((p) =>
                links.some((c) => c.telegramId.value === p.telegramId.value && inDistrict(c)),
            )
            .filter((p) => !busy(p.telegramId.value))
            .slice(0, limit)
    }
    async saveInvite(invite: CourierInvite): Promise<void> {
        this.invites.set(invite.code, invite)
    }
    /** Set to N to let the next N claims lose a race to someone faster. */
    inviteRaces = 0
    async claimInvite(invite: CourierInvite): Promise<boolean> {
        if (this.inviteRaces > 0) {
            this.inviteRaces--
            return false
        }
        this.invites.set(invite.code, invite)
        return true
    }
    async findInvite(code: string): Promise<CourierInvite | null> {
        return this.invites.get(code) ?? null
    }
}

export class InMemoryDistricts implements DistrictRepository {
    readonly items = new Map<string, District>()

    async findById(id: string): Promise<District | null> {
        return this.items.get(id) ?? null
    }
    async findByName(name: string): Promise<District | null> {
        const wanted = name.toLowerCase()
        return [...this.items.values()].find((d) => d.name.toLowerCase() === wanted) ?? null
    }
    async list(): Promise<District[]> {
        return [...this.items.values()]
    }
    async save(district: District): Promise<void> {
        this.items.set(district.id, district)
    }
}

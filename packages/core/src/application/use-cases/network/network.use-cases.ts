import { Courier } from "../../../domain/entities/courier.js"
import { District, districtOf } from "../../../domain/entities/district.js"
import { OrderStatus, isFinalStatus } from "../../../domain/enums/order-status.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { addDays } from "../../../domain/shared/time.js"
import { Location } from "../../../domain/value-objects/location.js"
import { toCourierProfileDTO } from "../../dtos/courier.dto.js"
import { toOrderDTO } from "../../dtos/order.dto.js"
import { requireBusiness, requireOwnedBusiness } from "../shared.js"

import type { Business } from "../../../domain/entities/business.js"
import type { CourierProfile } from "../../../domain/entities/courier-profile.js"
import type { Order } from "../../../domain/entities/order.js"
import type { CourierProfileDTO, NetworkOrderDTO } from "../../dtos/courier.dto.js"
import type { OrderDTO } from "../../dtos/order.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { CourierRepository } from "../../ports/courier-repository.js"
import type { DistrictRepository } from "../../ports/district-repository.js"
import type { OrderRepository } from "../../ports/order-repository.js"

/** The network list a courier sees: enough for a busy evening, small for D1. */
export const NETWORK_ORDERS_LIMIT = 30
/**
 * How many couriers get one network order in their chat: each message is a subrequest, and a
 * Worker request may make 50.
 */
export const NETWORK_FANOUT_LIMIT = 30
/** The admin's network report counts the last week. */
const STATS_DAYS = 7
const METERS_PER_KM = 1000

export interface NetworkDeps {
    businesses: BusinessRepository
    couriers: CourierRepository
    orders: OrderRepository
    districts: DistrictRepository
    clock: Clock
}

/** A shop asked the district network for a courier: who should hear about it. */
export interface NetworkRequest {
    order: OrderDTO
    business: Business
    district: District
}

/** The district a shop's location falls in now, by the current list of districts. */
export async function districtIdFor(
    districts: DistrictRepository,
    location: Location | undefined,
): Promise<string | undefined> {
    return location ? districtOf(await districts.list(), location)?.id : undefined
}

/** The profile of someone a shop approved (or who still owes a shop it delivered for). */
async function requireNetworkProfile(
    couriers: CourierRepository,
    telegramId: number,
): Promise<{ profile: CourierProfile; links: Courier[] }> {
    const [profile, links] = await Promise.all([
        couriers.findProfile(telegramId),
        couriers.listByPerson(telegramId),
    ])
    if (!profile || !links.some((link) => link.isActive || link.isNetwork)) {
        throw ForbiddenError.notACourier()
    }
    return { profile, links }
}

/** Districts of the shops that approved this person: the network orders they may see. */
async function districtsOfPerson(deps: NetworkDeps, links: readonly Courier[]): Promise<string[]> {
    const shops = await Promise.all(
        links.filter((link) => link.isActive).map((l) => deps.businesses.findById(l.businessId)),
    )
    return [...new Set(shops.flatMap((shop) => (shop?.districtId ? [shop.districtId] : [])))]
}

/** Carrying a network order already: one at a time, so a courier never hoards them. */
async function isBusy(
    orders: OrderRepository,
    links: readonly Courier[],
    now: Date,
): Promise<boolean> {
    const lists = await Promise.all(links.map((link) => orders.listByCourier(link.id, now)))
    return lists.flat().some((order) => order.isViaNetwork() && !isFinalStatus(order.status))
}

export function toNetworkOrderDTO(order: Order, shop: Business): NetworkOrderDTO {
    return {
        id: order.id,
        businessId: order.businessId,
        shopName: shop.name,
        shopAddress: shop.address,
        number: order.number,
        total: order.total.amount,
        itemsCount: order.items.length,
        bottlesReturned: order.bottlesReturned,
        distanceMeters:
            shop.location && order.location ? shop.location.distanceTo(order.location) : undefined,
        requestedAt: (order.networkRequestedAt ?? order.updatedAt).toISOString(),
    }
}

function requireAdmin(admins: readonly number[], telegramId: number): void {
    if (!admins.includes(telegramId)) {
        throw ForbiddenError.notPlatformAdmin()
    }
}

export class SetDistrictUseCase {
    constructor(
        private readonly deps: NetworkDeps,
        private readonly platformAdminIds: readonly number[],
    ) {}

    /**
     * The admin creates or moves a district (`center` + `radiusKm`), or sets how long an order
     * may wait (`waitMinutes`). Every shop's district is recomputed. Returns the shops inside.
     */
    async execute(input: {
        actorTelegramId: number
        name: string
        center?: { latitude: number; longitude: number }
        radiusKm?: number
        waitMinutes?: number
    }): Promise<{ district: District; shops: number }> {
        requireAdmin(this.platformAdminIds, input.actorTelegramId)
        const { districts } = this.deps
        const now = this.deps.clock.now()
        let district = await districts.findByName(input.name.trim())
        const center =
            input.center && Location.create(input.center.latitude, input.center.longitude)
        const radius = input.radiusKm === undefined ? undefined : input.radiusKm * METERS_PER_KM
        if (center && radius !== undefined) {
            if (district) {
                district.moveTo(center, Math.round(radius), now)
            } else {
                district = District.create({
                    id: crypto.randomUUID(),
                    name: input.name,
                    center,
                    radiusMeters: Math.round(radius),
                    now,
                })
            }
        }
        if (!district) {
            throw ValidationError.fromField("center", "A new district needs a center and a radius")
        }
        if (input.waitMinutes !== undefined) {
            district.setWaitMinutes(input.waitMinutes, now)
        }
        await districts.save(district)
        const shops = await recomputeDistricts(this.deps)
        return { district, shops: shops.get(district.id) ?? 0 }
    }
}

/** Puts every shop with a location into its district. Returns the shop count per district. */
async function recomputeDistricts(deps: NetworkDeps): Promise<Map<string, number>> {
    const [all, shops] = await Promise.all([
        deps.districts.list(),
        deps.businesses.listWithLocation(),
    ])
    const counts = new Map<string, number>()
    for (const shop of shops) {
        const districtId = districtOf(all, shop.location)?.id
        if (districtId) {
            counts.set(districtId, (counts.get(districtId) ?? 0) + 1)
        }
        if (districtId !== shop.districtId) {
            shop.setDistrict(districtId)
            await deps.businesses.save(shop)
        }
    }
    return counts
}

export class SetNetworkMembershipUseCase {
    constructor(private readonly deps: NetworkDeps) {}

    /** The courier's own consent: deliver for other shops of the district, or stop. */
    async execute(input: { telegramId: number; inNetwork: boolean }): Promise<CourierProfileDTO> {
        const { profile } = await requireNetworkProfile(this.deps.couriers, input.telegramId)
        const now = this.deps.clock.now()
        profile.setInNetwork(input.inNetwork, now)
        await this.deps.couriers.saveProfile(profile)
        return toCourierProfileDTO(profile, now)
    }
}

export class OfferNetworkUseCase {
    constructor(private readonly deps: NetworkDeps) {}

    /** True once per person: right after a shop approves them, the bot offers the network. */
    async execute(input: { telegramId: number }): Promise<boolean> {
        const profile = await this.deps.couriers.findProfile(input.telegramId)
        if (!profile || profile.inNetwork || !profile.offerNetwork(this.deps.clock.now())) {
            return false
        }
        await this.deps.couriers.saveProfile(profile)
        return true
    }
}

async function requestNetwork(
    deps: NetworkDeps,
    order: Order,
    business: Business,
): Promise<NetworkRequest> {
    const district = business.districtId ? await deps.districts.findById(business.districtId) : null
    if (!district) {
        throw BusinessRuleViolationError.noDistrict(business.id)
    }
    order.requestNetwork(deps.clock.now())
    await deps.orders.save(order)
    return { order: toOrderDTO(order), business, district }
}

async function requireShopOrder(
    orders: OrderRepository,
    orderId: string,
    businessId: string,
): Promise<Order> {
    const order = await orders.findById(orderId)
    if (!order || order.businessId !== businessId) {
        throw EntityNotFoundError.order(orderId)
    }
    return order
}

export class RequestNetworkCourierUseCase {
    constructor(private readonly deps: NetworkDeps) {}

    /** «Отдать сети района»: the owner hands the order to the district's network couriers. */
    async execute(input: {
        actorTelegramId: number
        businessId: string
        orderId: string
    }): Promise<NetworkRequest> {
        const business = await requireOwnedBusiness(
            this.deps.businesses,
            input.businessId,
            input.actorTelegramId,
        )
        const order = await requireShopOrder(this.deps.orders, input.orderId, business.id)
        return requestNetwork(this.deps, order, business)
    }
}

export class AutoRequestNetworkUseCase {
    constructor(private readonly deps: NetworkDeps) {}

    /**
     * Right after the shop accepts an order: when none of its own couriers can take it now and
     * the shop keeps network delivery on, the district network gets it. Null: nothing to do.
     */
    async execute(input: { orderId: string }): Promise<NetworkRequest | null> {
        const order = await this.deps.orders.findById(input.orderId)
        if (!order || order.status !== OrderStatus.ACCEPTED || order.courierId !== undefined) {
            return null
        }
        const business = await requireBusiness(this.deps.businesses, order.businessId)
        if (!business.networkDelivery || !business.districtId) {
            return null
        }
        const now = this.deps.clock.now()
        const own = await this.deps.couriers.listByBusiness(business.id)
        if (own.some((courier) => courier.isAvailable(now))) {
            return null
        }
        return requestNetwork(this.deps, order, business)
    }
}

export class ListNetworkOrdersUseCase {
    constructor(private readonly deps: NetworkDeps) {}

    /** Network orders of the courier's districts waiting for «Беру». Empty outside the network. */
    async execute(input: { telegramId: number }): Promise<NetworkOrderDTO[]> {
        const { profile, links } = await requireNetworkProfile(this.deps.couriers, input.telegramId)
        if (!profile.inNetwork) {
            return []
        }
        const districtIds = await districtsOfPerson(this.deps, links)
        if (districtIds.length === 0) {
            return []
        }
        // A shop that removed this person, or has not approved them yet, does not see them here.
        const blocked = new Set(
            links.filter((l) => !l.isActive && !l.isNetwork).map((l) => l.businessId),
        )
        const orders = (
            await this.deps.orders.listWaitingForNetwork(districtIds, NETWORK_ORDERS_LIMIT)
        ).filter((order) => !blocked.has(order.businessId))
        const shopIds = [...new Set(orders.map((order) => order.businessId))]
        const shops = new Map(
            (await Promise.all(shopIds.map((id) => this.deps.businesses.findById(id))))
                .filter((shop): shop is Business => shop !== null)
                .map((shop) => [shop.id, shop]),
        )
        return orders.flatMap((order) => {
            const shop = shops.get(order.businessId)
            return shop ? [toNetworkOrderDTO(order, shop)] : []
        })
    }
}

/** Who took a network order: the order now has a courier of the network. */
export interface NetworkClaim {
    order: OrderDTO
    business: Business
    courierTelegramId: number
}

export class ClaimNetworkOrderUseCase {
    constructor(private readonly deps: NetworkDeps) {}

    /** «Беру»: the first network courier wins; everyone after them gets NETWORK_ORDER_TAKEN. */
    async execute(input: { telegramId: number; orderId: string }): Promise<NetworkClaim> {
        const { couriers, orders } = this.deps
        const { profile, links } = await requireNetworkProfile(couriers, input.telegramId)
        const order = await orders.findById(input.orderId)
        if (!order) {
            throw EntityNotFoundError.order(input.orderId)
        }
        const business = await requireBusiness(this.deps.businesses, order.businessId)
        const districtIds = await districtsOfPerson(this.deps, links)
        if (!business.districtId || !districtIds.includes(business.districtId)) {
            throw ForbiddenError.notACourier()
        }
        const now = this.deps.clock.now()
        const existing = links.find((link) => link.businessId === business.id)
        const link =
            existing ??
            Courier.forNetwork({ id: crypto.randomUUID(), businessId: business.id, profile, now })
        order.claimByNetwork(link, now, await isBusy(orders, links, now))
        if (!existing) {
            await couriers.save(link)
        }
        if (!(await orders.claimForNetwork(order))) {
            throw BusinessRuleViolationError.networkOrderTaken(order.id)
        }
        return { order: toOrderDTO(order), business, courierTelegramId: input.telegramId }
    }
}

/** A network order nobody took in time: the shop and the admins hear about it once. */
export interface OverdueNetworkOrder {
    order: OrderDTO
    business: Business
    district: District
}

export class OverdueNetworkOrdersUseCase {
    constructor(private readonly deps: NetworkDeps) {}

    /**
     * Network orders waiting longer than their district allows, not reported yet; marks them
     * reported. No cron: runs on every network event and on the admin's `/network`.
     */
    async execute(): Promise<OverdueNetworkOrder[]> {
        const districts = await this.deps.districts.list()
        if (districts.length === 0) {
            return []
        }
        const byId = new Map(districts.map((d) => [d.id, d]))
        const now = this.deps.clock.now()
        const waiting = await this.deps.orders.listWaitingForNetwork(
            districts.map((d) => d.id),
            NETWORK_ORDERS_LIMIT,
        )
        const overdue: OverdueNetworkOrder[] = []
        for (const order of waiting) {
            if (order.networkAlertedAt || !order.networkRequestedAt) {
                continue
            }
            const business = await this.deps.businesses.findById(order.businessId)
            const district = business?.districtId ? byId.get(business.districtId) : undefined
            if (!business || !district || now < district.overdueAt(order.networkRequestedAt)) {
                continue
            }
            order.markNetworkAlerted(now)
            await this.deps.orders.save(order)
            overdue.push({ order: toOrderDTO(order), business, district })
        }
        return overdue
    }
}

export interface DistrictStats {
    id: string
    name: string
    center: { latitude: number; longitude: number }
    /** Shops whose location is inside the circle. */
    shops: number
    radiusKm: number
    waitMinutes: number
    freeCouriers: number
    waiting: number
    /** Delivered in the last 7 days, and how many of them a network courier took. */
    delivered: number
    viaNetwork: number
}

export class NetworkStatsUseCase {
    constructor(
        private readonly deps: NetworkDeps,
        private readonly platformAdminIds: readonly number[],
    ) {}

    /** «Tumanlar» for the admin: per district, who is free now and the network's share. */
    async execute(input: { actorTelegramId: number }): Promise<DistrictStats[]> {
        requireAdmin(this.platformAdminIds, input.actorTelegramId)
        const now = this.deps.clock.now()
        const from = addDays(now, -STATS_DAYS)
        const [districts, located] = await Promise.all([
            this.deps.districts.list(),
            this.deps.businesses.listWithLocation(),
        ])
        const shops = new Map<string, number>()
        for (const shop of located) {
            if (shop.districtId) {
                shops.set(shop.districtId, (shops.get(shop.districtId) ?? 0) + 1)
            }
        }
        return Promise.all(
            districts.map(async (district) => {
                const [free, waiting, share] = await Promise.all([
                    this.deps.couriers.listFreeNetworkCouriers(
                        district.id,
                        now,
                        NETWORK_FANOUT_LIMIT,
                    ),
                    this.deps.orders.listWaitingForNetwork([district.id], NETWORK_ORDERS_LIMIT),
                    this.deps.orders.networkShare(district.id, from, now),
                ])
                return {
                    id: district.id,
                    name: district.name,
                    center: {
                        latitude: district.center.latitude,
                        longitude: district.center.longitude,
                    },
                    shops: shops.get(district.id) ?? 0,
                    radiusKm: district.radiusMeters / METERS_PER_KM,
                    waitMinutes: district.waitMinutes,
                    freeCouriers: free.length,
                    waiting: waiting.length,
                    ...share,
                }
            }),
        )
    }
}

export class FreeNetworkCouriersUseCase {
    constructor(private readonly deps: NetworkDeps) {}

    /** Who gets «Новый заказ рядом» for an order of this district. */
    async execute(input: { districtId: string }): Promise<number[]> {
        const profiles = await this.deps.couriers.listFreeNetworkCouriers(
            input.districtId,
            this.deps.clock.now(),
            NETWORK_FANOUT_LIMIT,
        )
        return profiles.map((profile) => profile.telegramId.value)
    }
}

import { CourierProfile } from "../../../domain/entities/courier-profile.js"
import { Courier, CourierInvite } from "../../../domain/entities/courier.js"
import { CourierStatus } from "../../../domain/enums/courier-status.js"
import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { startOfLocalDay } from "../../../domain/shared/time.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"
import { toCourierDTO, toCourierProfileDTO } from "../../dtos/courier.dto.js"
import { toOrderDTO } from "../../dtos/order.dto.js"
import { displayNameOf } from "../../dtos/telegram-user.js"
import { ListNetworkOrdersUseCase } from "../network/network.use-cases.js"
import { requireBusiness, requireOwnedBusiness } from "../shared.js"

import type { Business } from "../../../domain/entities/business.js"
import type {
    CourierDTO,
    CourierHomeDTO,
    CourierOrderDTO,
    CourierProfileDTO,
    CourierShopDTO,
} from "../../dtos/courier.dto.js"
import type { OrderDTO } from "../../dtos/order.dto.js"
import type { TelegramUser } from "../../dtos/telegram-user.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { CourierRepository } from "../../ports/courier-repository.js"
import type { DistrictRepository } from "../../ports/district-repository.js"
import type { OrderRepository } from "../../ports/order-repository.js"

/** 12 random bytes → 16 url-safe characters: fits Telegram's `start` payload (max 64). */
const INVITE_CODE_BYTES = 12

function newInviteCode(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(INVITE_CODE_BYTES))
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
}

export interface CourierDeps {
    businesses: BusinessRepository
    couriers: CourierRepository
    orders: OrderRepository
    clock: Clock
}

export interface CourierHomeDeps extends CourierDeps {
    districts: DistrictRepository
}

/** The approved courier link of this person in this shop, or a 403. */
export async function requireCourier(
    couriers: CourierRepository,
    businessId: string,
    telegramId: number,
): Promise<Courier> {
    const courier = await couriers.findByTelegramId(businessId, telegramId)
    if (!courier?.worksFor(businessId)) {
        throw ForbiddenError.notCourier(businessId)
    }
    return courier
}

/** A courier link of this shop, for its owner. */
async function requireShopCourier(
    deps: CourierDeps,
    input: { actorTelegramId: number; businessId: string; courierId: string },
): Promise<Courier> {
    await requireOwnedBusiness(deps.businesses, input.businessId, input.actorTelegramId)
    const courier = await deps.couriers.findById(input.courierId)
    if (!courier || courier.businessId !== input.businessId) {
        throw EntityNotFoundError.courier(input.courierId)
    }
    return courier
}

/** The profile of someone approved by at least one shop: only couriers have a courier screen. */
async function requireCourierProfile(
    couriers: CourierRepository,
    telegramId: number,
): Promise<CourierProfile> {
    const [profile, links] = await Promise.all([
        couriers.findProfile(telegramId),
        couriers.listByPerson(telegramId),
    ])
    // A network link counts too: the person still sees the orders they took for that shop.
    if (!profile || !links.some((link) => link.isActive || link.isNetwork)) {
        throw ForbiddenError.notACourier()
    }
    return profile
}

export class CreateCourierInviteUseCase {
    constructor(private readonly deps: CourierDeps) {}

    /** Returns the code for `t.me/<courier_bot>?start=c_<code>` and when it stops working. */
    async execute(input: {
        actorTelegramId: number
        businessId: string
    }): Promise<{ code: string; expiresAt: string }> {
        await requireOwnedBusiness(this.deps.businesses, input.businessId, input.actorTelegramId)
        const invite = CourierInvite.create({
            code: newInviteCode(),
            businessId: input.businessId,
            now: this.deps.clock.now(),
        })
        await this.deps.couriers.saveInvite(invite)
        return { code: invite.code, expiresAt: invite.expiresAt.toISOString() }
    }
}

export interface JoinedCourier {
    courier: CourierDTO
    business: Business
    /** The courier bot asks for the phone once: a shop calls its courier. */
    needsPhone: boolean
}

export class JoinAsCourierUseCase {
    constructor(private readonly deps: CourierDeps) {}

    /**
     * Whoever opens the invite in the LLS courier bot asks to become a courier of that shop.
     * One profile per person; the shop's owner approves the new link.
     */
    async execute(input: { code: string; user: TelegramUser }): Promise<JoinedCourier> {
        const { couriers, clock } = this.deps
        const invite = await couriers.findInvite(input.code)
        if (!invite) {
            throw EntityNotFoundError.invite()
        }
        const business = await requireBusiness(this.deps.businesses, invite.businessId)
        const now = clock.now()
        invite.use(now)
        const profile =
            (await couriers.findProfile(input.user.id)) ??
            CourierProfile.create({
                telegramId: TelegramId.create(input.user.id),
                name: displayNameOf(input.user),
                now,
            })
        const existing = await couriers.findByTelegramId(business.id, input.user.id)
        const courier =
            existing ??
            Courier.join({ id: crypto.randomUUID(), businessId: business.id, profile, now })
        existing?.rejoin(now)
        await couriers.saveInvite(invite)
        await couriers.saveProfile(profile)
        await couriers.save(courier)
        return {
            courier: toCourierDTO(courier, now),
            business,
            needsPhone: profile.phone === undefined,
        }
    }
}

export class ListCouriersUseCase {
    constructor(private readonly deps: CourierDeps) {}

    /** The shop's couriers: waiting for approval first, then approved. */
    async execute(input: { actorTelegramId: number; businessId: string }): Promise<CourierDTO[]> {
        await requireOwnedBusiness(this.deps.businesses, input.businessId, input.actorTelegramId)
        const now = this.deps.clock.now()
        const couriers = await this.deps.couriers.listByBusiness(input.businessId)
        return couriers
            .map((courier) => toCourierDTO(courier, now))
            .sort(
                (a, b) =>
                    Number(a.status !== CourierStatus.PENDING) -
                    Number(b.status !== CourierStatus.PENDING),
            )
    }
}

export interface CourierChange {
    courier: CourierDTO
    /** Whom to tell in the courier bot. */
    telegramId: number
}

export class ReviewCourierUseCase {
    constructor(private readonly deps: CourierDeps) {}

    /** The owner approves (or declines) someone who accepted the shop's invite. */
    async execute(input: {
        actorTelegramId: number
        businessId: string
        courierId: string
        approve: boolean
    }): Promise<CourierChange> {
        const courier = await requireShopCourier(this.deps, input)
        const now = this.deps.clock.now()
        if (input.approve) {
            courier.approve(now)
        } else {
            courier.decline(now)
        }
        await this.deps.couriers.save(courier)
        return { courier: toCourierDTO(courier, now), telegramId: courier.telegramId.value }
    }
}

export class SetCourierScheduleUseCase {
    constructor(private readonly deps: CourierDeps) {}

    /** The owner's week for a courier, and "сегодня не работает". */
    async execute(input: {
        actorTelegramId: number
        businessId: string
        courierId: string
        workDays?: string[]
        offToday?: boolean
    }): Promise<CourierDTO> {
        const courier = await requireShopCourier(this.deps, input)
        const now = this.deps.clock.now()
        if (input.workDays !== undefined) {
            courier.setWorkDays(input.workDays, now)
        }
        if (input.offToday !== undefined) {
            courier.setOffToday(input.offToday, now)
        }
        await this.deps.couriers.save(courier)
        return toCourierDTO(courier, now)
    }
}

export class DeactivateCourierUseCase {
    constructor(private readonly deps: CourierDeps) {}

    /** Returns whom to tell: the person stays a courier of their other shops. */
    async execute(input: {
        actorTelegramId: number
        businessId: string
        courierId: string
    }): Promise<{ telegramId: number }> {
        const courier = await requireShopCourier(this.deps, input)
        courier.deactivate(this.deps.clock.now())
        await this.deps.couriers.save(courier)
        return { telegramId: courier.telegramId.value }
    }
}

export class AssignCourierUseCase {
    constructor(private readonly deps: CourierDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        orderId: string
        courierId: string
    }): Promise<OrderDTO> {
        const { orders } = this.deps
        const courier = await requireShopCourier(this.deps, input)
        const order = await orders.findById(input.orderId)
        if (!order || order.businessId !== input.businessId) {
            throw EntityNotFoundError.order(input.orderId)
        }
        order.assignCourier(courier, this.deps.clock.now())
        await orders.save(order)
        return toOrderDTO(order)
    }
}

export class SetShiftUseCase {
    constructor(private readonly deps: CourierDeps) {}

    /** "Я на смене" for today, or the end of the shift. */
    async execute(input: { telegramId: number; onShift: boolean }): Promise<CourierProfileDTO> {
        const profile = await requireCourierProfile(this.deps.couriers, input.telegramId)
        const now = this.deps.clock.now()
        if (input.onShift) {
            profile.startShift(now)
        } else {
            profile.endShift(now)
        }
        await this.deps.couriers.saveProfile(profile)
        return toCourierProfileDTO(profile, now)
    }
}

export class UpdateCourierProfileUseCase {
    constructor(private readonly deps: CourierDeps) {}

    async execute(input: {
        telegramId: number
        vehicle: string | null
    }): Promise<CourierProfileDTO> {
        const profile = await requireCourierProfile(this.deps.couriers, input.telegramId)
        const now = this.deps.clock.now()
        profile.setVehicle(input.vehicle, now)
        await this.deps.couriers.saveProfile(profile)
        return toCourierProfileDTO(profile, now)
    }
}

export class GetCourierHomeUseCase {
    constructor(private readonly deps: CourierHomeDeps) {}

    /**
     * The courier's screen across all their shops: on the road plus finished today, each order
     * with its shop's name, and network orders waiting nearby. Shops they delivered for through
     * the network are listed while they have orders there today.
     */
    async execute(input: { telegramId: number }): Promise<CourierHomeDTO> {
        const { couriers, businesses, orders } = this.deps
        const profile = await requireCourierProfile(couriers, input.telegramId)
        const now = this.deps.clock.now()
        const since = startOfLocalDay(now)
        const links = (await couriers.listByPerson(input.telegramId)).filter(
            (l) => l.isActive || l.isNetwork,
        )
        const perShop = await Promise.all(
            links.map(async (link) => {
                const [business, list] = await Promise.all([
                    businesses.findById(link.businessId),
                    orders.listByCourier(link.id, since),
                ])
                const shopName = business?.name ?? "—"
                const shop: CourierShopDTO = {
                    businessId: link.businessId,
                    shopName,
                    status: link.status,
                    workDays: [...link.workDays],
                    worksToday: link.worksToday(now),
                }
                const shopOrders: CourierOrderDTO[] = list.map((o) => ({
                    ...toOrderDTO(o),
                    shopName,
                }))
                return { shop, shopOrders, network: link.isNetwork }
            }),
        )
        return {
            profile: toCourierProfileDTO(profile, now),
            shops: perShop.filter((p) => !p.network || p.shopOrders.length > 0).map((p) => p.shop),
            orders: perShop
                .flatMap((p) => p.shopOrders)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
            network: await new ListNetworkOrdersUseCase(this.deps).execute(input),
        }
    }
}

import { Courier, CourierInvite } from "../../../domain/entities/courier.js"
import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { startOfLocalDay } from "../../../domain/shared/time.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"
import { toCourierDTO } from "../../dtos/courier.dto.js"
import { toOrderDTO } from "../../dtos/order.dto.js"
import { displayNameOf } from "../../dtos/telegram-user.js"
import { requireBusiness, requireOwnedBusiness } from "../shared.js"

import type { CourierDTO } from "../../dtos/courier.dto.js"
import type { OrderDTO } from "../../dtos/order.dto.js"
import type { TelegramUser } from "../../dtos/telegram-user.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { CourierRepository } from "../../ports/courier-repository.js"
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

/** The active courier record of this person in this shop, or a 403. */
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

export class CreateCourierInviteUseCase {
    constructor(private readonly deps: CourierDeps) {}

    /** Returns the code for `t.me/<shop_bot>?start=c_<code>` and when it stops working. */
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

export class JoinAsCourierUseCase {
    constructor(private readonly deps: CourierDeps) {}

    /** Whoever opens the invite link in the shop bot becomes (again) a courier of that shop. */
    async execute(input: {
        code: string
        businessId: string
        user: TelegramUser
    }): Promise<CourierDTO> {
        const { couriers, clock } = this.deps
        const invite = await couriers.findInvite(input.code)
        // An invite of another shop's bot is treated as unknown: codes never cross shops.
        if (!invite || invite.businessId !== input.businessId) {
            throw EntityNotFoundError.invite()
        }
        const now = clock.now()
        invite.use(now)
        const name = displayNameOf(input.user)
        const existing = await couriers.findByTelegramId(input.businessId, input.user.id)
        const courier =
            existing ??
            Courier.join({
                id: crypto.randomUUID(),
                businessId: input.businessId,
                telegramId: TelegramId.create(input.user.id),
                name,
                now,
            })
        if (existing) {
            existing.rejoin(name, now)
        }
        await couriers.saveInvite(invite)
        await couriers.save(courier)
        return toCourierDTO(courier)
    }
}

export class ListCouriersUseCase {
    constructor(private readonly deps: CourierDeps) {}

    async execute(input: { actorTelegramId: number; businessId: string }): Promise<CourierDTO[]> {
        await requireOwnedBusiness(this.deps.businesses, input.businessId, input.actorTelegramId)
        return (await this.deps.couriers.listActive(input.businessId)).map(toCourierDTO)
    }
}

export class DeactivateCourierUseCase {
    constructor(private readonly deps: CourierDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        courierId: string
    }): Promise<void> {
        await requireOwnedBusiness(this.deps.businesses, input.businessId, input.actorTelegramId)
        const courier = await this.deps.couriers.findById(input.courierId)
        if (!courier || courier.businessId !== input.businessId) {
            throw EntityNotFoundError.courier(input.courierId)
        }
        courier.deactivate(this.deps.clock.now())
        await this.deps.couriers.save(courier)
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
        const { businesses, couriers, orders } = this.deps
        await requireOwnedBusiness(businesses, input.businessId, input.actorTelegramId)
        const order = await orders.findById(input.orderId)
        if (!order || order.businessId !== input.businessId) {
            throw EntityNotFoundError.order(input.orderId)
        }
        const courier = await couriers.findById(input.courierId)
        if (!courier || courier.businessId !== input.businessId) {
            throw EntityNotFoundError.courier(input.courierId)
        }
        order.assignCourier(courier)
        await orders.save(order)
        return toOrderDTO(order)
    }
}

export class ListCourierOrdersUseCase {
    constructor(private readonly deps: CourierDeps) {}

    /** The courier's screen: everything still on the road, plus what they finished today. */
    async execute(input: { telegramId: number; businessId: string }): Promise<OrderDTO[]> {
        await requireBusiness(this.deps.businesses, input.businessId)
        const courier = await requireCourier(this.deps.couriers, input.businessId, input.telegramId)
        const since = startOfLocalDay(this.deps.clock.now())
        return (await this.deps.orders.listByCourier(courier.id, since)).map(toOrderDTO)
    }
}

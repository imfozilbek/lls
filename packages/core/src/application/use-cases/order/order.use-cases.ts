import { ACTIVE_ORDER_STATUSES, OrderStatus } from "../../../domain/enums/order-status.js"
import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toOrderDTO } from "../../dtos/order.dto.js"
import { emptyPage, mapPage, normalizePage } from "../../dtos/pagination.js"
import { requireBusiness, requireOwnedBusiness } from "../shared.js"

import type { Order, OrderMover } from "../../../domain/entities/order.js"
import type { PaidWith } from "../../../domain/enums/payment.js"
import type { OrderDTO } from "../../dtos/order.dto.js"
import type { Page } from "../../dtos/pagination.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { CourierRepository } from "../../ports/courier-repository.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"
import type { OrderRepository } from "../../ports/order-repository.js"

export interface OrderAccessDeps {
    businesses: BusinessRepository
    customers: CustomerRepository
    couriers: CourierRepository
    orders: OrderRepository
}

type Participant = OrderMover | { role: "customer" }

/** Loads an order of this shop. An order of another shop is "not found", never leaked. */
async function requireOrder(
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

/** Who is asking: the shop owner, the courier the order is assigned to, the customer, or nobody. */
async function participantOf(
    deps: OrderAccessDeps,
    order: Order,
    telegramId: number,
): Promise<Participant> {
    const business = await requireBusiness(deps.businesses, order.businessId)
    if (business.isOwnedBy(telegramId)) {
        return { role: "owner" }
    }
    const courier = await deps.couriers.findByTelegramId(order.businessId, telegramId)
    if (courier?.worksFor(order.businessId) && order.isAssignedTo(courier.id)) {
        return { role: "courier", courierId: courier.id }
    }
    const customer = await deps.customers.findByTelegramId(telegramId)
    if (customer && order.isPlacedBy(customer.id)) {
        return { role: "customer" }
    }
    throw ForbiddenError.notOrderParticipant(order.id)
}

export class GetOrderUseCase {
    constructor(private readonly deps: OrderAccessDeps) {}

    async execute(input: {
        telegramId: number
        businessId: string
        orderId: string
    }): Promise<OrderDTO> {
        const order = await requireOrder(this.deps.orders, input.orderId, input.businessId)
        await participantOf(this.deps, order, input.telegramId)
        return toOrderDTO(order)
    }
}

export class CancelOrderUseCase {
    constructor(private readonly deps: OrderAccessDeps) {}

    async execute(input: {
        telegramId: number
        businessId: string
        orderId: string
        reason?: string
    }): Promise<OrderDTO> {
        const order = await requireOrder(this.deps.orders, input.orderId, input.businessId)
        const { role } = await participantOf(this.deps, order, input.telegramId)
        // Couriers never cancel: they call the owner, who decides.
        if (role === "courier") {
            throw ForbiddenError.stepNotAllowed(order.id, OrderStatus.CANCELLED)
        }
        order.cancel(role, input.reason)
        await this.deps.orders.save(order)
        return toOrderDTO(order)
    }
}

export class AdvanceOrderUseCase {
    constructor(private readonly deps: OrderAccessDeps) {}

    /**
     * The owner makes any step; the assigned courier only "picked up" and "delivered".
     * `to` is explicit so a double tap on an old button fails instead of skipping a step.
     */
    async execute(input: {
        actorTelegramId: number
        businessId: string
        orderId: string
        to: OrderStatus
        /** With "delivered": how the customer paid at the door. */
        paidWith?: PaidWith
    }): Promise<OrderDTO> {
        const order = await requireOrder(this.deps.orders, input.orderId, input.businessId)
        const mover = await participantOf(this.deps, order, input.actorTelegramId)
        if (mover.role === "customer") {
            throw ForbiddenError.notOwner(order.businessId)
        }
        order.advanceTo(input.to, mover, input.paidWith)
        await this.deps.orders.save(order)
        return toOrderDTO(order)
    }
}

export class CourierAdvanceOrderUseCase {
    constructor(private readonly deps: OrderAccessDeps) {}

    /** From the courier bot or the courier screen: the shop is the order's own shop. */
    async execute(input: {
        telegramId: number
        orderId: string
        to: OrderStatus
        paidWith?: PaidWith
    }): Promise<OrderDTO> {
        const order = await this.deps.orders.findById(input.orderId)
        if (!order) {
            throw EntityNotFoundError.order(input.orderId)
        }
        return new AdvanceOrderUseCase(this.deps).execute({
            actorTelegramId: input.telegramId,
            businessId: order.businessId,
            orderId: order.id,
            to: input.to,
            paidWith: input.paidWith,
        })
    }
}

export class ListMyOrdersUseCase {
    constructor(
        private readonly customers: CustomerRepository,
        private readonly orders: OrderRepository,
    ) {}

    async execute(input: {
        telegramId: number
        businessId: string
        page?: number
        limit?: number
    }): Promise<Page<OrderDTO>> {
        const request = normalizePage(input)
        const customer = await this.customers.findByTelegramId(input.telegramId)
        if (!customer) {
            return emptyPage(request)
        }
        const page = await this.orders.listByCustomer(customer.id, input.businessId, request)
        return mapPage(page, toOrderDTO)
    }
}

export type ShopOrdersFilter = "active" | "done" | "all"

const FINISHED_STATUSES: readonly OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELLED]

function statusesFor(filter: ShopOrdersFilter): readonly OrderStatus[] | undefined {
    if (filter === "active") {
        return ACTIVE_ORDER_STATUSES
    }
    return filter === "done" ? FINISHED_STATUSES : undefined
}

export class ListShopOrdersUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly orders: OrderRepository,
    ) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        filter?: ShopOrdersFilter
        page?: number
        limit?: number
    }): Promise<Page<OrderDTO>> {
        await requireOwnedBusiness(this.businesses, input.businessId, input.actorTelegramId)
        const page = await this.orders.listByBusiness(
            input.businessId,
            statusesFor(input.filter ?? "all"),
            normalizePage(input),
        )
        return mapPage(page, toOrderDTO)
    }
}

import { ACTIVE_ORDER_STATUSES, OrderStatus } from "../../../domain/enums/order-status.js"
import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toOrderDTO } from "../../dtos/order.dto.js"
import { emptyPage, mapPage, normalizePage } from "../../dtos/pagination.js"
import { requireBusiness, requireOwnedBusiness } from "../shared.js"

import type { CancelledBy, Order } from "../../../domain/entities/order.js"
import type { OrderDTO } from "../../dtos/order.dto.js"
import type { Page } from "../../dtos/pagination.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"
import type { OrderRepository } from "../../ports/order-repository.js"

export interface OrderAccessDeps {
    businesses: BusinessRepository
    customers: CustomerRepository
    orders: OrderRepository
}

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

/** Who is asking about this order: its shop owner, the customer who placed it, or nobody. */
async function roleOf(
    deps: OrderAccessDeps,
    order: Order,
    telegramId: number,
): Promise<CancelledBy> {
    const business = await requireBusiness(deps.businesses, order.businessId)
    if (business.isOwnedBy(telegramId)) {
        return "owner"
    }
    const customer = await deps.customers.findByTelegramId(telegramId)
    if (customer && order.isPlacedBy(customer.id)) {
        return "customer"
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
        await roleOf(this.deps, order, input.telegramId)
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
        const role = await roleOf(this.deps, order, input.telegramId)
        order.cancel(role, input.reason)
        await this.deps.orders.save(order)
        return toOrderDTO(order)
    }
}

export class AdvanceOrderUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly orders: OrderRepository,
    ) {}

    /** `to` is explicit so a double tap on an old button fails instead of skipping a step. */
    async execute(input: {
        actorTelegramId: number
        businessId: string
        orderId: string
        to: OrderStatus
    }): Promise<OrderDTO> {
        const order = await requireOrder(this.orders, input.orderId, input.businessId)
        await requireOwnedBusiness(this.businesses, order.businessId, input.actorTelegramId)
        order.advanceTo(input.to)
        await this.orders.save(order)
        return toOrderDTO(order)
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

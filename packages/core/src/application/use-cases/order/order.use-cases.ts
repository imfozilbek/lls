import { ACTIVE_ORDER_STATUSES, OrderStatus } from "../../../domain/enums/order-status.js"
import { PaymentStatus } from "../../../domain/enums/payment.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toOrderDTO } from "../../dtos/order.dto.js"
import { emptyPage, mapPage, normalizePage } from "../../dtos/pagination.js"
import { requireBusiness, requireOwnedBusiness } from "../shared.js"

import type { Order, OrderMover } from "../../../domain/entities/order.js"
import type { OrderDTO } from "../../dtos/order.dto.js"
import type { Page } from "../../dtos/pagination.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { CourierRepository } from "../../ports/courier-repository.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"
import type { OrderRepository } from "../../ports/order-repository.js"
import type { ReceiptStore } from "../../ports/receipt-store.js"

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
    if (courier?.deliversFor(order.businessId) && order.isAssignedTo(courier.id)) {
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
    }): Promise<OrderDTO> {
        const order = await requireOrder(this.deps.orders, input.orderId, input.businessId)
        const mover = await participantOf(this.deps, order, input.actorTelegramId)
        if (mover.role === "customer") {
            throw ForbiddenError.notOwner(order.businessId)
        }
        order.advanceTo(input.to, mover)
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
        })
    }
}

export interface TransferDeps extends OrderAccessDeps {
    receipts: ReceiptStore
    clock: Clock
}

export class MarkTransferSentUseCase {
    constructor(private readonly deps: TransferDeps) {}

    /**
     * «Я перевёл» with the screenshot of the transfer: only the customer of the order; the owner
     * then checks the card. A new screenshot replaces the old one until the money is confirmed.
     * `changed` is false once the money is confirmed: nobody is pinged twice.
     */
    async execute(input: {
        telegramId: number
        businessId: string
        orderId: string
        receipt: { bytes: Uint8Array; contentType: string }
    }): Promise<{ order: OrderDTO; changed: boolean }> {
        const { orders, receipts } = this.deps
        const order = await requireOrder(orders, input.orderId, input.businessId)
        // The customer of this very order, even when it is the owner testing his own shop.
        const customer = await this.deps.customers.findByTelegramId(input.telegramId)
        if (!customer || !order.isPlacedBy(customer.id)) {
            throw ForbiddenError.notOrderParticipant(order.id)
        }
        if (order.isCash()) {
            throw BusinessRuleViolationError.notATransfer(order.id)
        }
        const open = [PaymentStatus.UNPAID, PaymentStatus.AWAITING].includes(order.payment.status)
        if (!open) {
            return { order: toOrderDTO(order), changed: false }
        }
        if (input.receipt.bytes.byteLength === 0) {
            throw BusinessRuleViolationError.receiptRequired()
        }
        const stored = await receipts.put({
            businessId: order.businessId,
            orderId: order.id,
            ...input.receipt,
        })
        const previous = order.payment.receipt?.key
        order.markTransferSent({
            ...stored,
            at: this.deps.clock.now(),
            reusedFrom: await orders.findReceiptReuse({
                hash: stored.hash,
                orderId: order.id,
                businessId: order.businessId,
                customerId: customer.id,
            }),
            customerRejections: await orders.countTransferRejections(customer.id, order.id),
        })
        await orders.save(order)
        if (previous && previous !== stored.key) {
            await receipts.remove(previous)
        }
        return { order: toOrderDTO(order), changed: true }
    }
}

/**
 * «Do'konga eslatish»: the shop has not answered the transfer for a while; only the order's
 * customer asks, at most once per pause (`TRANSFER_REMIND_AFTER_MS`).
 */
export class RemindTransferUseCase {
    constructor(private readonly deps: TransferDeps) {}

    async execute(input: {
        telegramId: number
        businessId: string
        orderId: string
    }): Promise<OrderDTO> {
        const order = await requireOrder(this.deps.orders, input.orderId, input.businessId)
        const customer = await this.deps.customers.findByTelegramId(input.telegramId)
        if (!customer || !order.isPlacedBy(customer.id)) {
            throw ForbiddenError.notOrderParticipant(order.id)
        }
        order.remindTransfer(this.deps.clock.now())
        await this.deps.orders.save(order)
        return toOrderDTO(order)
    }
}

/** The screenshot of an order's transfer: only for its customer and the shop's owner. */
export class GetTransferReceiptUseCase {
    constructor(private readonly deps: OrderAccessDeps) {}

    async execute(input: {
        telegramId: number
        businessId: string
        orderId: string
    }): Promise<{ key: string; sentAt: Date }> {
        const order = await requireOrder(this.deps.orders, input.orderId, input.businessId)
        const { role } = await participantOf(this.deps, order, input.telegramId)
        const receipt = order.payment.receipt
        if (role === "courier" || !receipt) {
            throw EntityNotFoundError.order(order.id)
        }
        return { key: receipt.key, sentAt: receipt.at }
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

/**
 * What changes when the shop's open orders change: a cheap check the owner's screen polls; the
 * list itself is read again only when this moved (the free plan counts every row read).
 */
export class ShopOrdersVersionUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly orders: OrderRepository,
    ) {}

    async execute(input: { actorTelegramId: number; businessId: string }): Promise<string> {
        await requireOwnedBusiness(this.businesses, input.businessId, input.actorTelegramId)
        return this.orders.activeVersion(input.businessId)
    }
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

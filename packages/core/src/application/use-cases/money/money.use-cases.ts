import { CashHandover } from "../../../domain/entities/cash-handover.js"
import { OrderStatus } from "../../../domain/enums/order-status.js"
import { PaymentStatus } from "../../../domain/enums/payment.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { addDays, startOfLocalDay, startOfLocalMonth } from "../../../domain/shared/time.js"
import { Money } from "../../../domain/value-objects/money.js"
import { toOrderDTO } from "../../dtos/order.dto.js"
import { requireCourier } from "../courier/courier.use-cases.js"
import { requireOwnedBusiness } from "../shared.js"

import type { Order } from "../../../domain/entities/order.js"
import type { PaymentMethod } from "../../../domain/enums/payment.js"
import type { CourierCashDTO, MoneyPeriod, MoneyReportDTO } from "../../dtos/money.dto.js"
import type { OrderDTO } from "../../dtos/order.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { CashHandoverRepository } from "../../ports/cash-handover-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { CourierRepository } from "../../ports/courier-repository.js"
import type { OrderRepository } from "../../ports/order-repository.js"

const WEEK_DAYS = 7
/** Open payments shown at once; a small shop rarely has more. */
const OPEN_PAYMENTS_LIMIT = 100
/** One export covers a month of a busy small shop. */
export const EXPORT_LIMIT = 5000

export interface MoneyDeps {
    businesses: BusinessRepository
    couriers: CourierRepository
    orders: OrderRepository
    handovers: CashHandoverRepository
    clock: Clock
}

/** [from, to) of a period in Tashkent days: today, the last 7 days, or this month. */
export function periodRange(period: MoneyPeriod, now: Date): { from: Date; to: Date } {
    const today = startOfLocalDay(now)
    const to = addDays(today, 1)
    if (period === "today") {
        return { from: today, to }
    }
    if (period === "week") {
        return { from: addDays(today, 1 - WEEK_DAYS), to }
    }
    return { from: startOfLocalMonth(now), to }
}

/** Cash each courier holds: taken at doors minus handed over. Only couriers who hold some. */
async function courierCash(deps: MoneyDeps, businessId: string): Promise<CourierCashDTO[]> {
    const [collected, handed] = await Promise.all([
        deps.orders.cashCollectedByCourier(businessId),
        deps.handovers.totalsByCourier(businessId),
    ])
    const given = new Map(handed.map((h) => [h.courierId, h.amount]))
    const holding = collected
        .map((c) => ({ courierId: c.courierId, onHand: c.amount - (given.get(c.courierId) ?? 0) }))
        .filter((c) => c.onHand > 0)
    const couriers = await Promise.all(holding.map((c) => deps.couriers.findById(c.courierId)))
    return holding
        .map((c, i) => ({
            ...c,
            name: couriers[i]?.name ?? "—",
            isActive: couriers[i]?.isActive ?? false,
        }))
        .sort((a, b) => b.onHand - a.onHand)
}

function isDebt(order: Order): boolean {
    return order.status === OrderStatus.DELIVERED && order.payment.status === PaymentStatus.UNPAID
}

export class GetMoneyReportUseCase {
    constructor(private readonly deps: MoneyDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        period: MoneyPeriod
    }): Promise<MoneyReportDTO> {
        const { businessId } = input
        await requireOwnedBusiness(this.deps.businesses, businessId, input.actorTelegramId)
        const { from, to } = periodRange(input.period, this.deps.clock.now())
        const [totals, open, couriers] = await Promise.all([
            this.deps.orders.moneyTotals(businessId, from, to),
            this.deps.orders.listOpenPayments(businessId, OPEN_PAYMENTS_LIMIT),
            courierCash(this.deps, businessId),
        ])
        const pick = (keep: (order: Order) => boolean): OrderDTO[] =>
            open.filter(keep).map(toOrderDTO)
        return {
            period: input.period,
            from: from.toISOString(),
            to: to.toISOString(),
            totals,
            awaiting: pick(
                (o) =>
                    o.payment.status === PaymentStatus.AWAITING &&
                    o.status !== OrderStatus.CANCELLED,
            ),
            debts: pick(isDebt),
            refunds: pick((o) => o.payment.status === PaymentStatus.REFUND_DUE),
            couriers,
        }
    }
}

async function requireShopOrder(
    deps: MoneyDeps,
    input: { actorTelegramId: number; businessId: string; orderId: string },
): Promise<Order> {
    await requireOwnedBusiness(deps.businesses, input.businessId, input.actorTelegramId)
    const order = await deps.orders.findById(input.orderId)
    if (!order || order.businessId !== input.businessId) {
        throw EntityNotFoundError.order(input.orderId)
    }
    return order
}

/** The owner saw the money: a transfer arrived, or a debt was paid. */
export class ConfirmPaymentUseCase {
    constructor(private readonly deps: MoneyDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        orderId: string
        method: PaymentMethod
    }): Promise<OrderDTO> {
        const order = await requireShopOrder(this.deps, input)
        order.confirmPayment(input.method)
        await this.deps.orders.save(order)
        return toOrderDTO(order)
    }
}

/** The owner gave the money of a cancelled order back. */
export class MarkRefundedUseCase {
    constructor(private readonly deps: MoneyDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        orderId: string
    }): Promise<OrderDTO> {
        const order = await requireShopOrder(this.deps, input)
        order.markRefunded()
        await this.deps.orders.save(order)
        return toOrderDTO(order)
    }
}

/** A courier gave cash to the owner. Never more than they hold. */
export class RecordCashHandoverUseCase {
    constructor(private readonly deps: MoneyDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        courierId: string
        amount: number
    }): Promise<CourierCashDTO[]> {
        const { businessId } = input
        await requireOwnedBusiness(this.deps.businesses, businessId, input.actorTelegramId)
        const courier = await this.deps.couriers.findById(input.courierId)
        if (!courier || courier.businessId !== businessId) {
            throw EntityNotFoundError.courier(input.courierId)
        }
        const holding = await courierCash(this.deps, businessId)
        const onHand = holding.find((c) => c.courierId === courier.id)?.onHand ?? 0
        const handover = CashHandover.record({
            id: crypto.randomUUID(),
            businessId,
            courierId: courier.id,
            amount: Money.of(input.amount),
            onHand: Money.of(onHand),
            at: this.deps.clock.now(),
        })
        await this.deps.handovers.insert(handover)
        return courierCash(this.deps, businessId)
    }
}

/** Orders of a period for the owner's spreadsheet. */
export class ExportOrdersUseCase {
    constructor(private readonly deps: MoneyDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        period: MoneyPeriod
    }): Promise<{ from: Date; to: Date; orders: OrderDTO[] }> {
        await requireOwnedBusiness(this.deps.businesses, input.businessId, input.actorTelegramId)
        const { from, to } = periodRange(input.period, this.deps.clock.now())
        const orders = await this.deps.orders.listCreatedBetween(
            input.businessId,
            from,
            to,
            EXPORT_LIMIT,
        )
        return { from, to, orders: orders.map(toOrderDTO) }
    }
}

/** The courier's own cash on hand. */
export class GetCourierCashUseCase {
    constructor(private readonly deps: MoneyDeps) {}

    async execute(input: { telegramId: number; businessId: string }): Promise<{ onHand: number }> {
        const courier = await requireCourier(this.deps.couriers, input.businessId, input.telegramId)
        const holding = await courierCash(this.deps, input.businessId)
        return { onHand: holding.find((c) => c.courierId === courier.id)?.onHand ?? 0 }
    }
}

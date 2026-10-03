import { PaymentStatus } from "../../../domain/enums/payment.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { addDays, startOfLocalDay, startOfLocalMonth } from "../../../domain/shared/time.js"
import { toOrderDTO } from "../../dtos/order.dto.js"
import { requireOwnedBusiness } from "../shared.js"

import type { Order } from "../../../domain/entities/order.js"
import type { MoneyPeriod, MoneyReportDTO } from "../../dtos/money.dto.js"
import type { OrderDTO } from "../../dtos/order.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { OrderRepository } from "../../ports/order-repository.js"

const WEEK_DAYS = 7
/** Open payments shown at once; a small shop rarely has more. */
const OPEN_PAYMENTS_LIMIT = 100
/** One export covers a month of a busy small shop. */
export const EXPORT_LIMIT = 5000

export interface MoneyDeps {
    businesses: BusinessRepository
    orders: OrderRepository
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
        const [totals, open] = await Promise.all([
            this.deps.orders.moneyTotals(businessId, from, to),
            this.deps.orders.listOpenPayments(businessId, OPEN_PAYMENTS_LIMIT),
        ])
        const pick = (keep: (order: Order) => boolean): OrderDTO[] =>
            open.filter(keep).map(toOrderDTO)
        return {
            period: input.period,
            from: from.toISOString(),
            to: to.toISOString(),
            totals,
            // A cancelled order stays here too: if its transfer arrives, it is owed back.
            awaiting: pick((o) => o.payment.status === PaymentStatus.AWAITING),
            refunds: pick((o) => o.payment.status === PaymentStatus.REFUND_DUE),
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

/**
 * «Деньги пришли»: the owner saw the transfer on the card. A new order is accepted in the same
 * tap (the shop starts only after the money); on a cancelled order the money is owed back.
 */
export class ConfirmPaymentUseCase {
    constructor(private readonly deps: MoneyDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        orderId: string
    }): Promise<OrderDTO> {
        const order = await requireShopOrder(this.deps, input)
        order.confirmPaymentAndAccept()
        await this.deps.orders.save(order)
        return toOrderDTO(order)
    }
}

/**
 * «Pul kelmadi»: the owner did not find the transfer on the card. The order waits for the money
 * again; the customer is asked to check and send the screenshot again.
 */
export class RejectTransferUseCase {
    constructor(private readonly deps: MoneyDeps) {}

    async execute(input: {
        actorTelegramId: number
        businessId: string
        orderId: string
    }): Promise<OrderDTO> {
        const order = await requireShopOrder(this.deps, input)
        order.rejectTransfer()
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

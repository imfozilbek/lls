import { beforeEach, describe, expect, it } from "vitest"

import {
    AssignCourierUseCase,
    CreateCourierInviteUseCase,
    GetCourierHomeUseCase,
    JoinAsCourierUseCase,
    ReviewCourierUseCase,
    SetShiftUseCase,
} from "../../application/use-cases/courier/courier.use-cases.js"
import {
    ConfirmPaymentUseCase,
    ExportOrdersUseCase,
    GetMoneyReportUseCase,
    MarkRefundedUseCase,
    RecordCashHandoverUseCase,
    periodRange,
} from "../../application/use-cases/money/money.use-cases.js"
import {
    AdvanceOrderUseCase,
    CancelOrderUseCase,
} from "../../application/use-cases/order/order.use-cases.js"
import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import { UpdateShopUseCase } from "../../application/use-cases/shop/update-shop.use-case.js"
import { OrderStatus } from "../../domain/enums/order-status.js"
import { PaidWith, PaymentMethod, PaymentStatus } from "../../domain/enums/payment.js"
import { BusinessRuleViolationError } from "../../domain/errors/business-rule.error.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import {
    CUSTOMER_TG,
    OWNER_TG,
    STRANGER_TG,
    makeBusiness,
    makeCustomer,
    makeProduct,
} from "../fixtures.js"
import {
    InMemoryBusinesses,
    InMemoryCouriers,
    InMemoryCustomers,
    InMemoryDistricts,
    InMemoryHandovers,
    InMemoryOrders,
    InMemoryProducts,
    fixedClock,
} from "../in-memory.js"

import type { OrderDTO } from "../../application/dtos/order.dto.js"

const COURIER_TG = 5005
const CARD = { number: "4111111111111111", holder: "Rustam Karimov" }

describe("money: payments, courier cash, report", () => {
    // Deliveries are stamped with the real time: the report reads the same clock.
    const clock = fixedClock(new Date())
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts
    let customers: InMemoryCustomers
    let orders: InMemoryOrders
    let couriers: InMemoryCouriers
    let handovers: InMemoryHandovers
    let courierId: string

    const money = (): {
        businesses: InMemoryBusinesses
        couriers: InMemoryCouriers
        orders: InMemoryOrders
        handovers: InMemoryHandovers
        districts: InMemoryDistricts
        clock: typeof clock
    } => ({ businesses, couriers, orders, handovers, districts: new InMemoryDistricts(), clock })
    const access = (): {
        businesses: InMemoryBusinesses
        customers: InMemoryCustomers
        couriers: InMemoryCouriers
        orders: InMemoryOrders
    } => ({ businesses, customers, couriers, orders })

    async function place(paymentMethod?: PaymentMethod): Promise<OrderDTO> {
        return new PlaceOrderUseCase({ businesses, products, customers, orders, clock }).execute({
            user: { id: CUSTOMER_TG, firstName: "Aziz" },
            businessId: "biz-1",
            items: [{ productId: "prod-1", quantity: 2 }],
            address: "Navoiy 12",
            paymentMethod,
        })
    }

    /** Owner accepts, assigns the courier, kitchen steps, courier picks up and delivers. */
    async function deliver(order: OrderDTO, paidWith: PaidWith): Promise<OrderDTO> {
        const advance = new AdvanceOrderUseCase(access())
        const owner = { actorTelegramId: OWNER_TG, businessId: "biz-1", orderId: order.id }
        await advance.execute({ ...owner, to: OrderStatus.ACCEPTED })
        await new AssignCourierUseCase({ businesses, couriers, orders, clock }).execute({
            ...owner,
            courierId,
        })
        await advance.execute({ ...owner, to: OrderStatus.PREPARING })
        await advance.execute({ ...owner, to: OrderStatus.READY })
        const courier = { ...owner, actorTelegramId: COURIER_TG }
        await advance.execute({ ...courier, to: OrderStatus.PICKED_UP })
        return advance.execute({ ...courier, to: OrderStatus.DELIVERED, paidWith })
    }

    const report = (actorTelegramId = OWNER_TG) =>
        new GetMoneyReportUseCase(money()).execute({
            actorTelegramId,
            businessId: "biz-1",
            period: "today",
        })

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        products = new InMemoryProducts()
        customers = new InMemoryCustomers()
        orders = new InMemoryOrders()
        couriers = new InMemoryCouriers()
        handovers = new InMemoryHandovers()
        await businesses.save(makeBusiness())
        await products.save(makeProduct())
        await customers.save(makeCustomer())
        await customers.sharePhoneWith("cust-1", "biz-1", new Date())
        const deps = { businesses, couriers, orders, clock }
        const invite = await new CreateCourierInviteUseCase(deps).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
        })
        courierId = (
            await new JoinAsCourierUseCase(deps).execute({
                code: invite.code,
                user: { id: COURIER_TG, firstName: "Jasur" },
            })
        ).courier.id
        await new ReviewCourierUseCase(deps).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            courierId,
            approve: true,
        })
        await new SetShiftUseCase(deps).execute({ telegramId: COURIER_TG, onShift: true })
    })

    it("a transfer needs the shop's card", async () => {
        await expect(place(PaymentMethod.CARD_TRANSFER)).rejects.toThrow(BusinessRuleViolationError)
        await new UpdateShopUseCase(businesses, clock).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            patch: { payoutCard: CARD },
        })
        const order = await place(PaymentMethod.CARD_TRANSFER)
        expect(order.payment).toMatchObject({ method: "card_transfer", status: "awaiting" })
    })

    it("delivering needs to know how the customer paid", async () => {
        const order = await place()
        await expect(deliver(order, undefined as unknown as PaidWith)).rejects.toThrow()
    })

    it("cash: the courier holds it until handing it over; the report adds up", async () => {
        const order = await deliver(await place(), PaidWith.CASH)
        expect(order.payment).toMatchObject({
            status: "paid",
            method: "cash",
            cashCourierId: courierId,
        })
        // 2 × 35 000 + 10 000 delivery
        expect(order.total).toBe(80_000)

        let today = await report()
        expect(today.totals).toMatchObject({
            delivered: 1,
            goods: 70_000,
            delivery: 10_000,
            paidCash: 80_000,
            paidCard: 0,
            debt: 0,
        })
        expect(today.couriers).toEqual([
            { courierId, name: "Jasur", onHand: 80_000, isActive: true },
        ])
        const home = new GetCourierHomeUseCase(money())
        const onHand = async (): Promise<number | undefined> =>
            (await home.execute({ telegramId: COURIER_TG })).shops[0]?.onHand
        expect(await onHand()).toBe(80_000)

        const hand = new RecordCashHandoverUseCase(money())
        await expect(
            hand.execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                courierId,
                amount: 90_000,
            }),
        ).rejects.toThrow(BusinessRuleViolationError)
        await expect(
            hand.execute({
                actorTelegramId: STRANGER_TG,
                businessId: "biz-1",
                courierId,
                amount: 1,
            }),
        ).rejects.toThrow(ForbiddenError)
        await hand.execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            courierId,
            amount: 50_000,
        })
        expect(await onHand()).toBe(30_000)
        await hand.execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            courierId,
            amount: 30_000,
        })
        today = await report()
        expect(today.couriers).toEqual([])
    })

    it("a transfer at the door waits for the owner, then counts as card money", async () => {
        const order = await deliver(await place(), PaidWith.CARD_TRANSFER)
        let today = await report()
        expect(today.awaiting.map((o) => o.id)).toEqual([order.id])
        expect(today.totals.awaiting).toBe(80_000)
        // No cash went to the courier.
        expect(today.couriers).toEqual([])

        const confirmed = await new ConfirmPaymentUseCase(money()).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            orderId: order.id,
            method: PaymentMethod.CARD_TRANSFER,
        })
        expect(confirmed.payment.status).toBe(PaymentStatus.PAID)
        today = await report()
        expect(today.awaiting).toEqual([])
        expect(today.totals).toMatchObject({ paidCard: 80_000, awaiting: 0 })
    })

    it("delivered on credit is a debt until the owner marks it paid", async () => {
        const order = await deliver(await place(), PaidWith.LATER)
        let today = await report()
        expect(today.debts.map((o) => o.id)).toEqual([order.id])
        expect(today.totals.debt).toBe(80_000)
        await new ConfirmPaymentUseCase(money()).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            orderId: order.id,
            method: PaymentMethod.CASH,
        })
        today = await report()
        expect(today.debts).toEqual([])
        // Paid to the owner, not to a courier.
        expect(today.couriers).toEqual([])
        expect(today.totals.paidCash).toBe(80_000)
    })

    it("a paid order that is cancelled is owed back until the owner refunds it", async () => {
        await new UpdateShopUseCase(businesses, clock).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            patch: { payoutCard: CARD },
        })
        const order = await place(PaymentMethod.CARD_TRANSFER)
        const ids = { actorTelegramId: OWNER_TG, businessId: "biz-1", orderId: order.id }
        await new ConfirmPaymentUseCase(money()).execute({
            ...ids,
            method: PaymentMethod.CARD_TRANSFER,
        })
        await new CancelOrderUseCase(access()).execute({
            telegramId: OWNER_TG,
            businessId: "biz-1",
            orderId: order.id,
        })
        let today = await report()
        expect(today.refunds.map((o) => o.id)).toEqual([order.id])
        await new MarkRefundedUseCase(money()).execute(ids)
        today = await report()
        expect(today.refunds).toEqual([])
        expect(today.totals.cancelled).toBe(1)
    })

    it("only the owner sees the money; the export lists the period's orders", async () => {
        await place()
        await expect(report(STRANGER_TG)).rejects.toThrow(ForbiddenError)
        const exported = await new ExportOrdersUseCase(money()).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            period: "month",
        })
        expect(exported.orders).toHaveLength(1)
        await expect(
            new GetCourierHomeUseCase(money()).execute({ telegramId: STRANGER_TG }),
        ).rejects.toThrow(ForbiddenError)
    })

    it("periods: today, the last 7 days and this month", () => {
        const now = new Date("2026-10-15T12:00:00Z")
        const today = periodRange("today", now)
        expect(today.to.getTime() - today.from.getTime()).toBe(24 * 3600 * 1000)
        const week = periodRange("week", now)
        expect(week.to.getTime() - week.from.getTime()).toBe(7 * 24 * 3600 * 1000)
        expect(periodRange("month", now).from.toISOString()).toBe("2026-09-30T19:00:00.000Z")
    })
})

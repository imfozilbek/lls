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
    RejectTransferUseCase,
    periodRange,
} from "../../application/use-cases/money/money.use-cases.js"
import {
    AdvanceOrderUseCase,
    CancelOrderUseCase,
    MarkTransferSentUseCase,
    RemindTransferUseCase,
} from "../../application/use-cases/order/order.use-cases.js"
import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import { GetShopBySlugUseCase } from "../../application/use-cases/shop/get-shop.use-case.js"
import { Customer } from "../../domain/entities/customer.js"
import { Language } from "../../domain/enums/language.js"
import { OrderStatus } from "../../domain/enums/order-status.js"
import { PaymentMethod, PaymentStatus } from "../../domain/enums/payment.js"
import { BusinessRuleViolationError } from "../../domain/errors/business-rule.error.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { Phone } from "../../domain/value-objects/phone.js"
import { TelegramId } from "../../domain/value-objects/telegram-id.js"
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
    InMemoryOrders,
    InMemoryProducts,
    InMemoryReceipts,
    fixedClock,
} from "../in-memory.js"

import type { OrderDTO } from "../../application/dtos/order.dto.js"

const COURIER_TG = 5005

describe("money: transfer before the shop starts, report", () => {
    // Deliveries are stamped with the real time: the report reads the same clock.
    const clock = fixedClock(new Date())
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts
    let customers: InMemoryCustomers
    let orders: InMemoryOrders
    let couriers: InMemoryCouriers
    let receipts: InMemoryReceipts
    let courierId: string

    const money = (): {
        businesses: InMemoryBusinesses
        couriers: InMemoryCouriers
        orders: InMemoryOrders
        districts: InMemoryDistricts
        clock: typeof clock
    } => ({ businesses, couriers, orders, districts: new InMemoryDistricts(), clock })
    const access = (): {
        businesses: InMemoryBusinesses
        customers: InMemoryCustomers
        couriers: InMemoryCouriers
        orders: InMemoryOrders
    } => ({ businesses, customers, couriers, orders })
    const ids = (order: OrderDTO, actorTelegramId = OWNER_TG) => ({
        actorTelegramId,
        businessId: "biz-1",
        orderId: order.id,
    })

    async function place(): Promise<OrderDTO> {
        return new PlaceOrderUseCase({ businesses, products, customers, orders, clock }).execute({
            user: { id: CUSTOMER_TG, firstName: "Aziz" },
            businessId: "biz-1",
            items: [{ productId: "prod-1", quantity: 2 }],
            address: "Navoiy 12",
        })
    }

    /** «Я перевёл» from the customer. */
    const sent = async (
        order: OrderDTO,
        telegramId = CUSTOMER_TG,
        picture?: number[],
    ): Promise<OrderDTO> => (await sentOnce(order, telegramId, picture)).order
    const sentOnce = (order: OrderDTO, telegramId = CUSTOMER_TG, picture = [1, 2, 3]) =>
        new MarkTransferSentUseCase({ ...access(), receipts, clock }).execute({
            telegramId,
            businessId: "biz-1",
            orderId: order.id,
            receipt: { bytes: new Uint8Array(picture), contentType: "image/webp" },
        })

    /** «Деньги пришли, принять» from the owner. */
    const confirm = (order: OrderDTO, actorTelegramId = OWNER_TG): Promise<OrderDTO> =>
        new ConfirmPaymentUseCase(money()).execute(ids(order, actorTelegramId))

    /** Paid and accepted; the courier takes it; kitchen steps; picked up and delivered. */
    async function deliver(order: OrderDTO): Promise<OrderDTO> {
        const advance = new AdvanceOrderUseCase(access())
        await confirm(order)
        await new AssignCourierUseCase({ businesses, couriers, orders, clock }).execute({
            ...ids(order),
            courierId,
        })
        await advance.execute({ ...ids(order), to: OrderStatus.PREPARING })
        await advance.execute({ ...ids(order), to: OrderStatus.READY })
        const courier = ids(order, COURIER_TG)
        await advance.execute({ ...courier, to: OrderStatus.PICKED_UP })
        return advance.execute({ ...courier, to: OrderStatus.DELIVERED })
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
        receipts = new InMemoryReceipts()
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

    it("a shop without a card takes no orders; the storefront says so", async () => {
        await businesses.save(makeBusiness({ card: false }))
        await expect(place()).rejects.toThrow(BusinessRuleViolationError)
        await expect(place()).rejects.toThrow(/no card/)
        const shop = await new GetShopBySlugUseCase(businesses, clock).execute("osh-markaz")
        expect(shop.hasPayoutCard).toBe(false)
    })

    it("every order is a transfer, waiting for it before the shop starts", async () => {
        const order = await place()
        expect(order.payment).toMatchObject({ method: "card_transfer", status: "unpaid" })
        // Not paid yet: the owner cannot start.
        await expect(
            new AdvanceOrderUseCase(access()).execute({ ...ids(order), to: OrderStatus.ACCEPTED }),
        ).rejects.toThrow(/transfer has not arrived/)
        // Nothing to check until the customer says they sent it.
        expect((await report()).awaiting).toEqual([])
    })

    it("«Я перевёл» → the owner checks → «Деньги пришли, принять» in one tap", async () => {
        const order = await place()
        // Only the customer of the order presses «Я перевёл».
        await expect(sent(order, STRANGER_TG)).rejects.toThrow(ForbiddenError)
        await expect(sent(order, OWNER_TG)).rejects.toThrow(ForbiddenError)
        expect((await sent(order)).payment.status).toBe(PaymentStatus.AWAITING)
        // A new screenshot replaces the old one (and the old file is gone).
        const again = await sentOnce(order, CUSTOMER_TG, [4, 5, 6])
        expect(again.changed).toBe(true)
        expect(receipts.files.size).toBe(1)
        let today = await report()
        expect(today.awaiting.map((o) => o.id)).toEqual([order.id])

        await expect(confirm(order, STRANGER_TG)).rejects.toThrow(ForbiddenError)
        const accepted = await confirm(order)
        expect(accepted.status).toBe(OrderStatus.ACCEPTED)
        expect(accepted.payment).toMatchObject({ status: PaymentStatus.PAID })
        expect(accepted.payment.method).toBe(PaymentMethod.CARD_TRANSFER)
        today = await report()
        expect(today.awaiting).toEqual([])
        // Confirmed already: nothing to confirm again, and no new screenshot is taken.
        await expect(confirm(order)).rejects.toThrow(BusinessRuleViolationError)
        expect((await sentOnce(order)).changed).toBe(false)
    })

    it("no screenshot, no «Я перевёл»", async () => {
        const order = await place()
        await expect(sentOnce(order, CUSTOMER_TG, [])).rejects.toThrow(BusinessRuleViolationError)
    })

    it("the same screenshot for a second order is flagged for the owner", async () => {
        const first = await place()
        await sentOnce(first, CUSTOMER_TG, [9, 9, 9])
        const second = await place()
        const flagged = await sent(second, CUSTOMER_TG, [9, 9, 9])
        expect(flagged.payment.receipt?.reusedFrom).toBe(first.number)
        const fresh = await sent(await place(), CUSTOMER_TG, [7, 7, 7])
        expect(fresh.payment.receipt?.reusedFrom).toBeUndefined()
    })

    it("«Pul kelmadi»: back to unpaid, counted, and the next owner check sees it", async () => {
        const reject = (order: OrderDTO, actorTelegramId = OWNER_TG): Promise<OrderDTO> =>
            new RejectTransferUseCase(money()).execute(ids(order, actorTelegramId))
        const order = await place()
        await expect(reject(order)).rejects.toThrow(BusinessRuleViolationError)
        await sent(order)
        await expect(reject(order, STRANGER_TG)).rejects.toThrow(ForbiddenError)
        const rejected = await reject(order)
        expect(rejected.payment).toMatchObject({ status: PaymentStatus.UNPAID, rejections: 1 })
        const next = await sent(await place(), CUSTOMER_TG, [8, 8])
        expect(next.payment.receipt?.customerRejections).toBe(1)
    })

    it("the owner testing his own shop presses «Я перевёл» as its customer", async () => {
        await customers.save(
            Customer.register({
                id: "cust-owner",
                telegramId: TelegramId.create(OWNER_TG),
                name: "Rustam",
                language: Language.UZ,
            }),
        )
        const stored = await customers.findByTelegramId(OWNER_TG)
        stored?.setPhone(Phone.create("+998901112233"))
        if (stored) {
            await customers.save(stored)
        }
        await customers.sharePhoneWith("cust-owner", "biz-1", new Date())
        const order = await new PlaceOrderUseCase({
            businesses,
            products,
            customers,
            orders,
            clock,
        }).execute({
            user: { id: OWNER_TG, firstName: "Rustam" },
            businessId: "biz-1",
            items: [{ productId: "prod-1", quantity: 1 }],
            address: "Navoiy 12",
        })
        expect((await sent(order, OWNER_TG)).payment.status).toBe(PaymentStatus.AWAITING)
        // Someone else's order stays closed to him as a customer action.
        await expect(sent(await place(), OWNER_TG)).rejects.toThrow(ForbiddenError)
    })

    it("the owner may confirm a transfer the customer did not announce", async () => {
        const accepted = await confirm(await place())
        expect(accepted).toMatchObject({ status: OrderStatus.ACCEPTED })
    })

    it("delivered: one «Доставил», the courier carries no money; the report adds up", async () => {
        const order = await deliver(await place())
        expect(order.status).toBe(OrderStatus.DELIVERED)
        expect(order.payment).toMatchObject({ status: "paid", method: "card_transfer" })
        expect(order.payment.cashCourierId).toBeUndefined()
        // 2 × 35 000 + 10 000 delivery
        expect(order.total).toBe(80_000)

        const today = await report()
        expect(today.totals).toEqual({
            placed: 1,
            delivered: 1,
            cancelled: 0,
            goods: 70_000,
            delivery: 10_000,
            deposits: 0,
            paid: 80_000,
            paidCash: 0,
            commission: 0,
        })
        const home = await new GetCourierHomeUseCase(money()).execute({ telegramId: COURIER_TG })
        expect(home.shops[0]?.cashToHand).toBe(0)
        expect(today.courierCash).toEqual([])
    })

    it("a paid order that is cancelled is owed back until the owner refunds it", async () => {
        const order = await place()
        await confirm(order)
        await new CancelOrderUseCase(access()).execute({
            telegramId: OWNER_TG,
            businessId: "biz-1",
            orderId: order.id,
        })
        let today = await report()
        expect(today.refunds.map((o) => o.id)).toEqual([order.id])
        await new MarkRefundedUseCase(money()).execute(ids(order))
        today = await report()
        expect(today.refunds).toEqual([])
        expect(today.totals.cancelled).toBe(1)
        await expect(new MarkRefundedUseCase(money()).execute(ids(order))).rejects.toThrow(
            BusinessRuleViolationError,
        )
    })

    it("sent, then cancelled: the owner still sees it; if the money came, it is owed back", async () => {
        const order = await place()
        await sent(order)
        await new CancelOrderUseCase(access()).execute({
            telegramId: CUSTOMER_TG,
            businessId: "biz-1",
            orderId: order.id,
        })
        expect((await report()).awaiting.map((o) => o.id)).toEqual([order.id])
        const owed = await confirm(order)
        expect(owed).toMatchObject({ status: OrderStatus.CANCELLED })
        expect(owed.payment.status).toBe(PaymentStatus.REFUND_DUE)
        const today = await report()
        expect(today.awaiting).toEqual([])
        expect(today.refunds.map((o) => o.id)).toEqual([order.id])
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

    it("«Do'konga eslatish»: only the customer, only after the pause", async () => {
        const order = await sent(await place())
        const remind = (telegramId: number, minutes: number): Promise<OrderDTO> =>
            new RemindTransferUseCase({
                ...access(),
                receipts,
                clock: { now: (): Date => new Date(clock.now().getTime() + minutes * 60_000) },
            }).execute({ telegramId, businessId: "biz-1", orderId: order.id })
        await expect(remind(OWNER_TG, 11)).rejects.toBeInstanceOf(ForbiddenError)
        await expect(remind(CUSTOMER_TG, 5)).rejects.toMatchObject({ rule: "REMIND_TOO_SOON" })
        const reminded = await remind(CUSTOMER_TG, 11)
        expect(Date.parse(reminded.payment.remindableAt ?? "")).toBeGreaterThan(
            clock.now().getTime() + 20 * 60_000,
        )
        await expect(remind(CUSTOMER_TG, 12)).rejects.toMatchObject({ rule: "REMIND_TOO_SOON" })
    })
})

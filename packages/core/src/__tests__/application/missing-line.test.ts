import { beforeEach, describe, expect, it } from "vitest"

import { toOrderDTO } from "../../application/dtos/order.dto.js"
import {
    ConfirmPaymentUseCase,
    GetMoneyReportUseCase,
    MarkRefundedUseCase,
} from "../../application/use-cases/money/money.use-cases.js"
import { AdvanceOrderUseCase } from "../../application/use-cases/order/order.use-cases.js"
import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import { RemoveOrderLineUseCase } from "../../application/use-cases/order/remove-line.use-case.js"
import { Order } from "../../domain/entities/order.js"
import { OrderItem } from "../../domain/entities/order-item.js"
import { OrderChannel } from "../../domain/enums/order-channel.js"
import { OrderStatus } from "../../domain/enums/order-status.js"
import { PaymentMethod, PaymentStatus } from "../../domain/enums/payment.js"
import { Unit } from "../../domain/enums/unit.js"
import { EntityNotFoundError } from "../../domain/errors/not-found.error.js"
import { Money } from "../../domain/value-objects/money.js"
import {
    CUSTOMER_TG,
    NOON_MONDAY_UZ,
    OWNER_TG,
    PIN,
    STRANGER_TG,
    makeBusiness,
    makeCustomer,
    makeProduct,
    receiptSent,
    withReceipt,
} from "../fixtures.js"
import {
    InMemoryBusinesses,
    InMemoryCustomers,
    InMemoryOrders,
    InMemoryProducts,
    fixedClock,
} from "../in-memory.js"

import type { OrderDTO } from "../../application/dtos/order.dto.js"

function line(productId: string, name: string, price: number, quantity = 1): OrderItem {
    return OrderItem.create({
        productId,
        name,
        unit: Unit.PIECE,
        category: "meals",
        unitPrice: Money.of(price),
        quantity,
    })
}

/** Osh 2 × 35 000 and Somsa 8 000, delivery 10 000, a 10% showcase deal. */
function twoLines(method = PaymentMethod.CARD_TRANSFER): Order {
    return Order.place({
        id: "order-1",
        businessId: "biz-1",
        customerId: "cust-1",
        number: 1,
        channel: OrderChannel.MARKETPLACE,
        commissionBps: 1_000,
        items: [line("prod-1", "Osh", 35_000, 2), line("prod-2", "Somsa", 8_000)],
        deliveryFee: Money.of(10_000),
        address: "Navoiy 12",
        customerName: "Aziz",
        paymentMethod: method,
    })
}

describe("«Yo'q»: a line the shop did not have (owner's decision, November 2026)", () => {
    it("the goods and the commission go down, the delivery stays, a paid transfer owes it back", () => {
        const order = twoLines()
        withReceipt(order).confirmPaymentAndAccept()
        const removed = order.removeLine(1, NOON_MONDAY_UZ, Money.zero())
        expect(removed.name).toBe("Somsa")
        expect(order.items.map((i) => i.name)).toEqual(["Osh"])
        expect(order.removedItems.map((i) => i.name)).toEqual(["Somsa"])
        expect(order.subtotal.amount).toBe(70_000)
        expect(order.commission.amount).toBe(7_000)
        expect(order.deliveryFee.amount).toBe(10_000)
        expect(order.total.amount).toBe(80_000)
        expect(order.payment.refundOwed.amount).toBe(8_000)
        // The customer sees both: what comes and what was missing; the owner sees it is owed.
        const dto = toOrderDTO(order)
        expect(dto.items).toMatchObject([{ line: 0, name: "Osh" }])
        expect(dto.removedItems).toMatchObject([{ line: 1, name: "Somsa", total: 8_000 }])
        expect(dto.payment).toMatchObject({ refundOwed: 8_000, owedBack: 8_000 })
    })

    it("the last line stays (cancel instead); none after «Tayyor»; a line once only", () => {
        const order = twoLines(PaymentMethod.CASH)
        expect(() => order.removeLine(0, NOON_MONDAY_UZ, Money.zero())).toThrow(
            expect.objectContaining({ rule: "LINE_NOT_REMOVABLE" }),
        )
        order.accept()
        order.removeLine(0, NOON_MONDAY_UZ, Money.zero())
        expect(() => order.removeLine(0, NOON_MONDAY_UZ, Money.zero())).toThrow(EntityNotFoundError)
        expect(() => order.removeLine(1, NOON_MONDAY_UZ, Money.zero())).toThrow(
            expect.objectContaining({ rule: "LAST_LINE" }),
        )
        // Cash: nothing owed back, the courier takes the new sum at the door.
        expect(order.total.amount).toBe(18_000)
        expect(order.payment.refundOwed.isZero()).toBe(true)
        order.advanceTo(OrderStatus.PREPARING)
        order.deliverMyself()
        order.advanceTo(OrderStatus.READY)
        const after = twoLines(PaymentMethod.CASH)
        after.accept()
        after.advanceTo(OrderStatus.PREPARING)
        after.deliverMyself()
        after.advanceTo(OrderStatus.READY)
        expect(() => after.removeLine(1, NOON_MONDAY_UZ, Money.zero())).toThrow(
            expect.objectContaining({ rule: "LINE_NOT_REMOVABLE" }),
        )
    })

    it("«Qaytardim» closes the part; a cancel after it owes the rest, then all of it is closed", () => {
        const order = twoLines()
        withReceipt(order).confirmPaymentAndAccept()
        order.removeLine(1, NOON_MONDAY_UZ, Money.zero())
        order.markRefunded()
        expect(order.payment.refundOwed.isZero()).toBe(true)
        expect(order.payment.status).toBe(PaymentStatus.PAID)
        expect(() => order.markRefunded()).toThrow(
            expect.objectContaining({ rule: "PAYMENT_NOT_REFUNDABLE" }),
        )

        // Taken out, not given back yet, then cancelled: everything the customer paid is owed.
        const other = twoLines()
        withReceipt(other).confirmPaymentAndAccept()
        other.removeLine(1, NOON_MONDAY_UZ, Money.zero())
        other.cancel("owner", "Do'kon yopildi")
        expect(other.payment.owedBack(other.total).amount).toBe(88_000)
        other.markRefunded()
        expect(other.payment.status).toBe(PaymentStatus.REFUNDED)
        expect(other.payment.owedBack(other.total).isZero()).toBe(true)
    })

    it("a cancel gives back only the stock of the lines that stayed", () => {
        const order = Order.place({
            id: "order-2",
            businessId: "biz-1",
            customerId: "cust-1",
            number: 2,
            channel: OrderChannel.SHOP_BOT,
            commissionBps: 0,
            items: [
                OrderItem.create({ ...line("prod-1", "Osh", 35_000), fromStock: true }),
                OrderItem.create({ ...line("prod-2", "Somsa", 8_000, 3), fromStock: true }),
            ],
            deliveryFee: Money.zero(),
            address: "Navoiy 12",
            customerName: "Aziz",
            paymentMethod: PaymentMethod.CASH,
        })
        order.accept()
        order.removeLine(1, NOON_MONDAY_UZ, Money.zero())
        expect(order.stockTaken()).toEqual([{ productId: "prod-1", quantity: 1 }])
    })
})

describe("RemoveOrderLineUseCase", () => {
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts
    let orders: InMemoryOrders
    let order: OrderDTO
    const clock = fixedClock(NOON_MONDAY_UZ)

    const remove = (line: number, stopToday = false, actorTelegramId = OWNER_TG) =>
        new RemoveOrderLineUseCase({ businesses, orders, products, clock }).execute({
            actorTelegramId,
            businessId: "biz-1",
            orderId: order.id,
            line,
            stopToday,
        })

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        products = new InMemoryProducts()
        orders = new InMemoryOrders(undefined, products)
        const customers = new InMemoryCustomers()
        await businesses.save(makeBusiness())
        const somsa = makeProduct({ id: "prod-2", name: "Somsa", price: 8_000 })
        somsa.update({ stock: 5 })
        await products.save(makeProduct())
        await products.save(somsa)
        await customers.save(makeCustomer())
        await customers.sharePhoneWith("cust-1", "biz-1", NOON_MONDAY_UZ)
        order = await new PlaceOrderUseCase({
            businesses,
            products,
            customers,
            orders,
            clock,
        }).execute({
            user: { id: CUSTOMER_TG, firstName: "Aziz" },
            businessId: "biz-1",
            items: [
                { productId: "prod-1", quantity: 2 },
                { productId: "prod-2", quantity: 1 },
            ],
            address: "Navoiy 12",
            location: PIN,
        })
        await receiptSent(orders, order.id)
        const owner = { actorTelegramId: OWNER_TG, businessId: "biz-1", orderId: order.id }
        await new ConfirmPaymentUseCase({ businesses, orders, clock }).execute(owner)
        await new AdvanceOrderUseCase({
            businesses,
            orders,
            customers,
            couriers: { findByTelegramId: () => Promise.resolve(null) } as never,
        }).execute({ ...owner, to: OrderStatus.PREPARING })
    })

    it("the owner takes Somsa out: «Bugun boshqa sotilmasin» stops it today, its count is 0", async () => {
        const { order: after, removed } = await remove(1, true)
        expect(removed).toMatchObject({ name: "Somsa", quantity: 1 })
        expect(after).toMatchObject({ subtotal: 70_000, total: 80_000 })
        expect(after.payment).toMatchObject({ refundOwed: 8_000 })
        const somsa = products.items.get("prod-2")
        expect(somsa?.isAvailableAt(NOON_MONDAY_UZ)).toBe(false)
        expect(somsa?.stock).toBe(0)
        // «Pul» → «Qaytarish» shows it; «Qaytardim» closes it.
        const money = { businesses, orders, clock }
        const report = () =>
            new GetMoneyReportUseCase(money).execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                period: "today",
            })
        expect((await report()).refunds).toMatchObject([
            { id: order.id, payment: { owedBack: 8_000 } },
        ])
        await new MarkRefundedUseCase(money).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            orderId: order.id,
        })
        expect((await report()).refunds).toEqual([])
    })

    it("without the switch the shelf stays; a stranger cannot; another shop's order is not found", async () => {
        await remove(1)
        expect(products.items.get("prod-2")?.isAvailableAt(NOON_MONDAY_UZ)).toBe(true)
        await expect(remove(0, false, STRANGER_TG)).rejects.toThrow()
        await expect(
            new RemoveOrderLineUseCase({ businesses, orders, products, clock }).execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                orderId: "nope",
                line: 0,
                stopToday: false,
            }),
        ).rejects.toThrow(EntityNotFoundError)
    })
})

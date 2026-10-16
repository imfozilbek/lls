import { describe, expect, it } from "vitest"

import { toOrderDTO } from "../../application/dtos/order.dto.js"
import { Order } from "../../domain/entities/order.js"
import { OrderItem } from "../../domain/entities/order-item.js"
import { OrderChannel } from "../../domain/enums/order-channel.js"
import { OrderStatus } from "../../domain/enums/order-status.js"
import { Unit } from "../../domain/enums/unit.js"
import { Money } from "../../domain/value-objects/money.js"
import { Phone } from "../../domain/value-objects/phone.js"
import { makeCourier } from "../fixtures.js"

const NOW = new Date()

function readyOrder(): Order {
    const order = Order.place({
        id: "order-1",
        businessId: "biz-1",
        customerId: "cust-1",
        number: 1,
        channel: OrderChannel.SHOP_BOT,
        items: [
            OrderItem.create({
                productId: "p1",
                name: "To'y oshi",
                unit: Unit.PORTION,
                category: "meals",
                unitPrice: Money.of(45_000),
                quantity: 2,
            }),
        ],
        deliveryFee: Money.zero(),
        commissionBps: 0,
        address: "Navoiy 12",
        customerName: "Aziz",
        customerPhone: Phone.create("+998901234567"),
    })
    order.confirmPaymentAndStart()
    order.advanceTo(OrderStatus.READY)
    return order
}

describe("OrderDTO: phones", () => {
    it("carries the customer's phone, and the courier's once a courier took the order", () => {
        const order = readyOrder()
        expect(toOrderDTO(order)).toMatchObject({ customerPhone: "+998901234567" })
        expect(toOrderDTO(order).courierPhone).toBeUndefined()
        order.assignCourier(makeCourier({ now: NOW, phone: "+998901112233" }), NOW)
        expect(toOrderDTO(order).courierPhone).toBe("+998901112233")
        order.advanceTo(OrderStatus.PICKED_UP)
        order.advanceTo(OrderStatus.DELIVERED)
        expect(toOrderDTO(order).courierPhone).toBe("+998901112233")
    })
})

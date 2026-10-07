import { BusinessType, Language, OrderChannel, OrderStatus, PaymentStatus, Unit } from "@zumda/core"
import { describe, expect, it } from "vitest"

import { formatOrderForOwner } from "../src/telegram/format.js"

import type { OrderDTO } from "@zumda/core"

const TELEGRAM_MESSAGE_MAX = 4096

function orderOf(items: Array<Partial<OrderDTO["items"][number]>>): OrderDTO {
    return {
        id: "o-1",
        number: 7,
        items: items.map((item, i) => ({
            productId: `p-${i}`,
            name: `Mahsulot ${i}`,
            category: "other",
            unitPrice: 1000,
            total: 1000,
            ...item,
        })),
        subtotal: 1000,
        deliveryFee: 0,
        depositTotal: 0,
        total: 1000,
        bottlesReturned: 0,
        channel: OrderChannel.SHOP_BOT,
        status: OrderStatus.PENDING,
        payment: { method: "card_transfer", status: PaymentStatus.UNPAID },
        customerName: "Aziz",
        address: "Navoiy 12",
        waitingForNetwork: false,
        commission: 0,
        commissionBps: 0,
    } as unknown as OrderDTO
}

describe("the owner's order card", () => {
    it("says each unit in words: kilograms, grams, metres, hours; pieces are counted", () => {
        const card = formatOrderForOwner(
            orderOf([
                { name: "Non", unit: Unit.PIECE, quantity: 3 },
                { name: "Pomidor", unit: Unit.KG, quantity: 1500 },
                { name: "Qora murch", unit: Unit.G100, quantity: 300 },
                { name: "Yong'oq", unit: Unit.G100, quantity: 1200 },
                { name: "Gilam yuvish", unit: Unit.SQUARE_METRE, quantity: 12 },
                { name: "Usta", unit: Unit.HOUR, quantity: 2 },
                { name: "Tuxum", unit: Unit.TRAY, quantity: 1 },
            ]),
            { language: Language.UZ, type: BusinessType.STORE },
        )
        expect(card).toContain("Non × 3:")
        expect(card).toContain("Pomidor × 1,5 kg")
        expect(card).toContain("Qora murch × 300 g")
        expect(card).toContain("Yong'oq × 1,2 kg")
        expect(card).toContain("Gilam yuvish × 12 m²")
        expect(card).toContain("Usta × 2 soat")
        expect(card).toContain("Tuxum × 1 lotok")
    })

    it("a 50-line order stays within Telegram's 4096 characters", () => {
        const item = (i: number): OrderDTO["items"][number] =>
            ({
                productId: `p-${i}`,
                name: `${"Juda uzun nomli mahsulot ".repeat(4)}${i}`,
                unit: "pcs",
                category: "meals",
                unitPrice: 35_000,
                quantity: 2,
                total: 70_000,
            }) as OrderDTO["items"][number]
        const order = {
            id: "o-1",
            number: 7,
            items: Array.from({ length: 50 }, (_, i) => item(i)),
            subtotal: 3_500_000,
            deliveryFee: 10_000,
            depositTotal: 0,
            total: 3_510_000,
            bottlesReturned: 0,
            channel: OrderChannel.SHOP_BOT,
            status: OrderStatus.PENDING,
            payment: { method: "card_transfer", status: PaymentStatus.UNPAID },
            customerName: "Aziz",
            address: "Navoiy 12",
            comment: "x".repeat(500),
            waitingForNetwork: false,
            commission: 0,
            commissionBps: 0,
        } as unknown as OrderDTO
        const card = formatOrderForOwner(order, { language: Language.UZ, type: BusinessType.FOOD })
        expect(card.length).toBeLessThan(TELEGRAM_MESSAGE_MAX)
        expect(card).toContain("… va yana 30 ta")
    })
})

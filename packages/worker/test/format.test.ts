import { BusinessType, Language, OrderChannel, OrderStatus, PaymentStatus } from "@zumda/core"
import { describe, expect, it } from "vitest"

import { formatOrderForOwner } from "../src/telegram/format.js"

import type { OrderDTO } from "@zumda/core"

const TELEGRAM_MESSAGE_MAX = 4096

describe("the owner's order card", () => {
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

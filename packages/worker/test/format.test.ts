import {
    BusinessType,
    Language,
    OrderChannel,
    OrderStatus,
    PaymentStatus,
    SendWay,
    Unit,
} from "@zumda/core"
import { describe, expect, it } from "vitest"

import { ordersCsv } from "../src/http/csv.js"
import {
    courierKeyboard,
    formatOrderForCourier,
    formatLineRemovedForCustomer,
    formatOrderForOwner,
    formatStatusForCustomer,
    orderKeyboard,
    parseOrderCallback,
} from "../src/telegram/format.js"
import { textsFor } from "../src/telegram/texts.js"

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

describe("the customer's messages about the shop's steps", () => {
    const paid = (status: OrderStatus): OrderDTO => ({
        ...orderOf([{ name: "Osh" }]),
        status,
        payment: { method: "card_transfer", status: PaymentStatus.PAID } as OrderDTO["payment"],
    })
    const say = (status: OrderStatus, type: BusinessType): string | null =>
        formatStatusForCustomer(paid(status), { language: Language.UZ, type })

    it("accepted, then collected: two messages, the money seen once (owner's decision)", () => {
        expect(say(OrderStatus.ACCEPTED, BusinessType.GROCERY)).toBe(
            "✅ #7 buyurtmangiz qabul qilindi.\n💳 To'lovingiz keldi.",
        )
        expect(say(OrderStatus.PREPARING, BusinessType.GROCERY)).toBe(
            "📦 #7 buyurtmangiz hozir yig'ilmoqda.",
        )
        expect(say(OrderStatus.PREPARING, BusinessType.FOOD)).toBe(
            "👨‍🍳 #7 buyurtmangiz tayyorlanmoqda.",
        )
    })

    it("a service starts the moment it is accepted: one message", () => {
        expect(say(OrderStatus.PREPARING, BusinessType.SERVICE)).toBe(
            "✅ #7 buyurtmangiz qabul qilindi va bajarilmoqda.\n💳 To'lovingiz keldi.",
        )
    })
})

describe("«Yo'q»: a line the shop did not have", () => {
    const reader = { language: Language.UZ, type: BusinessType.FOOD }
    const missing = (method: "card_transfer" | "cash", refundOwed?: number): OrderDTO => ({
        ...orderOf([{ name: "Osh" }]),
        status: OrderStatus.PREPARING,
        total: 80_000,
        removedItems: orderOf([{ name: "Somsa" }]).items.map((item) => ({ ...item, line: 1 })),
        payment: { method, status: PaymentStatus.PAID, refundOwed } as OrderDTO["payment"],
    })

    it("the owner's card names it and the money owed back", () => {
        const card = formatOrderForOwner(missing("card_transfer", 8_000), reader)
        expect(card).toContain("❌ Somsa: yo'q")
        expect(card).toContain("💸 8 000 so'm qaytarish kerak")
    })

    it("the customer hears the new sum, and the money: owed back, or what to give", () => {
        expect(formatLineRemovedForCustomer(missing("card_transfer", 8_000), "Somsa", reader)).toBe(
            "#7: Somsa do'konda yo'q ekan, buyurtmadan olib tashlandi. Yangi summa: 80 000 so'm." +
                "\nDo'kon sizga 8 000 so'm qaytaradi.",
        )
        expect(formatLineRemovedForCustomer(missing("cash"), "Somsa", reader)).toContain(
            "Kuryerga 80 000 so'm berasiz.",
        )
    })
})

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

describe("the owner's CSV", () => {
    it("lists the goods with their picks and units, as plain text", () => {
        const csv = ordersCsv(
            [
                orderOf([
                    {
                        name: "Latte",
                        unit: Unit.PIECE,
                        quantity: 2,
                        options: { variantId: "v2", addonIds: ["a1"], label: "0,4 l · Sirop" },
                    },
                    { name: "Qora murch", unit: Unit.G100, quantity: 300 },
                ]),
            ],
            textsFor(Language.UZ, BusinessType.FOOD),
        )
        const [header, row] = csv.split("\r\n")
        expect(header?.split(";").at(-1)).toBe("Mahsulotlar")
        expect(row?.split(";").at(-1)).toBe("Latte (0,4 l · Sirop) × 2, Qora murch × 300 g")
    })
})

describe("a dispatcher's order in the bots", () => {
    const reader = { language: Language.UZ, type: BusinessType.STORE }
    const withDispatcher = (extra: Partial<OrderDTO>): OrderDTO => ({
        ...orderOf([{ name: "Mantiqiy kubik", unit: Unit.PIECE, quantity: 1 }]),
        payment: { method: "card_transfer", status: PaymentStatus.PAID } as OrderDTO["payment"],
        courierId: "c-1",
        courierName: "Dilshod",
        courierPhone: "+998901112233",
        dispatcher: true,
        deliveryNotes: [],
        customerPaysCarrier: false,
        needsCourierChoice: false,
        ...extra,
    })

    it("tells the customer how it went, with the note, the fee to the carrier and the phone", () => {
        const sent = withDispatcher({
            status: OrderStatus.PICKED_UP,
            sentVia: SendWay.TAXI,
            customerPaysCarrier: true,
        })
        expect(formatStatusForCustomer(sent, reader, "01 A 123 BC, 30 000 so'm")).toBe(
            [
                "🚕 #7 buyurtmangiz taksi bilan jo'natildi.",
                "📝 01 A 123 BC, 30 000 so'm",
                "💵 Yetkazish haqini yetkazuvchiga o'zingiz to'laysiz.",
                "📞 Dispetcher: +998 90 111 22 33",
            ].join("\n"),
        )
        const self = withDispatcher({ status: OrderStatus.PICKED_UP, sentVia: SendWay.SELF })
        expect(formatStatusForCustomer(self, reader)).toContain(
            "buyurtmangizni Dilshod olib kelmoqda",
        )
        // A rider's order reads as before.
        const rider = withDispatcher({ status: OrderStatus.PICKED_UP, dispatcher: false })
        expect(formatStatusForCustomer(rider, reader)).toBe(
            "🚚 #7 buyurtmangizni Dilshod olib kelmoqda.\n📞 Kuryer: +998 90 111 22 33",
        )
    })

    it("the dispatcher's card: where from, the notes, and «Jo'natdim» to the app once packed", () => {
        const preparing = withDispatcher({
            status: OrderStatus.PREPARING,
            deliveryNotes: [{ at: "2026-11-15T10:00:00.000Z", text: "Taksi <chaqirildi>" }],
        })
        const card = formatOrderForCourier(preparing, reader, { name: "ABC", address: "Bozor 1" })
        expect(card).toContain("🏪 Qayerdan: Bozor 1")
        expect(card).toContain("📝 Taksi &lt;chaqirildi&gt;")
        expect(card).toContain("Do'kon buyurtmani tayyorlayapti")
        expect(courierKeyboard(preparing, reader, "https://d/x").inline_keyboard).toEqual([])
        const ready = withDispatcher({
            status: OrderStatus.READY,
            nextStatus: OrderStatus.PICKED_UP,
        })
        expect(courierKeyboard(ready, reader, "https://d/x").inline_keyboard).toEqual([
            [{ text: "📮 Jo'natdim", web_app: { url: "https://d/x" } }],
        ])
    })

    it("the owner's card: no dispatcher's step; an order nobody is on goes to the app", () => {
        const ready = withDispatcher({
            status: OrderStatus.READY,
            nextStatus: OrderStatus.PICKED_UP,
        })
        const rows = orderKeyboard(ready, reader).inline_keyboard
        expect(rows.flat().map((b) => b.callback_data)).toEqual(["x:o-1"])
        const open = withDispatcher({
            status: OrderStatus.PREPARING,
            nextStatus: OrderStatus.READY,
            courierId: undefined,
            courierName: undefined,
            dispatcher: false,
            needsCourierChoice: true,
        })
        const choice = { url: "https://app/o", shopHasCouriers: true }
        expect(orderKeyboard(open, reader, choice).inline_keyboard[0]).toEqual([
            { text: "🛵 Kuryerga topshirish", web_app: { url: "https://app/o" } },
        ])
        // A shop without couriers: «O'zim yetkazaman» right in the chat, never «Tayyor» first.
        const alone = orderKeyboard(open, reader, { ...choice, shopHasCouriers: false })
        expect(alone.inline_keyboard[0]).toEqual([
            { text: "🙋 O'zim yetkazaman", callback_data: "m:o-1" },
        ])
        expect(parseOrderCallback("m:o-1")).toEqual({ kind: "deliverMyself", orderId: "o-1" })
        const owner = formatOrderForOwner(
            withDispatcher({ status: OrderStatus.PICKED_UP, sentVia: SendWay.POST }),
            reader,
        )
        expect(owner).toContain("📮 Dispetcher: Dilshod, +998 90 111 22 33")
        expect(owner).toContain("🚚 Jo'natildi: pochta orqali")
    })
})

describe("the delivery line says only what the shop promised (owner's decision, November 2026)", () => {
    const reader = { language: Language.UZ, type: BusinessType.STORE }
    const order = (extra: Partial<OrderDTO>): OrderDTO => ({
        ...orderOf([{ name: "Lego" }]),
        deliveryFree: false,
        customerPaysCarrier: false,
        ...extra,
    })

    it("the fee, «bepul» when promised, «keyin aytiladi», or no line at all", () => {
        expect(formatOrderForOwner(order({ deliveryFee: 10_000 }), reader)).toContain(
            "Yetkazib berish: 10 000 so'm",
        )
        expect(formatOrderForOwner(order({ deliveryFree: true }), reader)).toContain(
            "Yetkazib berish: bepul",
        )
        expect(formatOrderForOwner(order({ customerPaysCarrier: true }), reader)).toContain(
            "Yetkazib berish: keyin aytiladi, mijoz yetkazuvchiga o'zi to'laydi",
        )
        // A price never chosen: nothing about delivery, never «bepul».
        expect(formatOrderForOwner(order({}), reader)).not.toContain("Yetkazib berish")
    })

    it("a service says nothing about delivery, and cash is paid after the work", () => {
        const service = { language: Language.UZ, type: BusinessType.SERVICE }
        const cash = order({
            payment: { method: "cash", status: PaymentStatus.UNPAID } as OrderDTO["payment"],
        })
        const card = formatOrderForOwner(cash, service)
        expect(card).not.toContain("Yetkazib berish")
        expect(card).toContain("💵 Naqd: ishdan keyin olinadi")
        expect(card).not.toMatch(/yetkaz/i)
        expect(textsFor(Language.UZ, BusinessType.SERVICE).shopBotDescription).not.toMatch(
            /olib kelamiz/,
        )
    })
})

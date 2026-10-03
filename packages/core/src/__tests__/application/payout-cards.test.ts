import { beforeEach, describe, expect, it } from "vitest"

import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import {
    AddPayoutCardUseCase,
    ChoosePaymentCardUseCase,
    ListPayoutCardsUseCase,
    RemovePayoutCardUseCase,
} from "../../application/use-cases/shop/payout-cards.use-cases.js"
import { MAX_PAYOUT_CARDS, PayoutCardBook } from "../../domain/entities/payout-card-book.js"
import { BusinessRuleViolationError } from "../../domain/errors/business-rule.error.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../domain/errors/not-found.error.js"
import { ValidationError } from "../../domain/errors/validation.error.js"
import { PayoutCard } from "../../domain/value-objects/payout-card.js"
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
    InMemoryCustomers,
    InMemoryOrders,
    InMemoryPayoutCards,
    InMemoryProducts,
    fixedClock,
} from "../in-memory.js"

// Valid Luhn numbers, not real cards. secret-scan: fake
const FIRST = { number: "4111111111111111", holder: "Rustam Karimov" }
const SECOND = { number: "5614681234567893", holder: "Rustam Karimov" }
const THIRD = { number: "8600123456789012", holder: "Malika Karimova" }
const NOW = new Date("2026-10-02T10:00:00Z")

/** A Luhn-valid 16-digit number built from `seed`. */
function cardNumber(seed: number): string {
    const body = `400000000000${String(seed).padStart(3, "0")}`
    for (let check = 0; check <= 9; check++) {
        try {
            return PayoutCard.create(`${body}${check}`, "X").number
        } catch {
            // Not this check digit.
        }
    }
    throw new Error("No check digit")
}

describe("PayoutCardBook", () => {
    it("the first card becomes the payment card; more cards wait in the list", () => {
        const business = makeBusiness({ card: false })
        const book = new PayoutCardBook(business, [])
        const first = book.add({
            id: "a",
            card: PayoutCard.create(FIRST.number, FIRST.holder),
            now: NOW,
        })
        expect(business.paymentCardId).toBe("a")
        expect(business.acceptsCardTransfers()).toBe(true)
        book.add({ id: "b", card: PayoutCard.create(SECOND.number, SECOND.holder), now: NOW })
        expect(business.paymentCardId).toBe(first.id)
        expect(book.list().map((c) => c.id)).toEqual(["a", "b"])
    })

    it("no twice the same card, no more than the cap", () => {
        const book = new PayoutCardBook(makeBusiness({ card: false }), [])
        book.add({ id: "a", card: PayoutCard.create(FIRST.number, FIRST.holder), now: NOW })
        expect(() =>
            book.add({ id: "b", card: PayoutCard.create(FIRST.number, "Other"), now: NOW }),
        ).toThrow(/already added/)
        for (let i = 1; i < MAX_PAYOUT_CARDS; i++) {
            book.add({ id: `c${i}`, card: PayoutCard.create(cardNumber(i), "R"), now: NOW })
        }
        expect(book.list()).toHaveLength(MAX_PAYOUT_CARDS)
        expect(() =>
            book.add({ id: "x", card: PayoutCard.create(cardNumber(99), "R"), now: NOW }),
        ).toThrow(BusinessRuleViolationError)
    })

    it("switches the payment card; never removes it; unknown ids are not found", () => {
        const business = makeBusiness({ card: false })
        const book = new PayoutCardBook(business, [])
        book.add({ id: "a", card: PayoutCard.create(FIRST.number, FIRST.holder), now: NOW })
        book.add({ id: "b", card: PayoutCard.create(THIRD.number, THIRD.holder), now: NOW })
        expect(() => book.remove("a")).toThrow(/choose another payment card/)
        book.choose("b")
        expect(business.payoutCard?.holder).toBe("Malika Karimova")
        expect(book.remove("a").id).toBe("a")
        expect(book.list().map((c) => c.id)).toEqual(["b"])
        expect(() => book.choose("missing")).toThrow(EntityNotFoundError)
        expect(() => book.remove("missing")).toThrow(EntityNotFoundError)
    })
})

describe("payout card use cases", () => {
    const clock = fixedClock(NOW)
    let businesses: InMemoryBusinesses
    let cards: InMemoryPayoutCards
    const deps = (): {
        businesses: InMemoryBusinesses
        cards: InMemoryPayoutCards
        clock: typeof clock
    } => ({ businesses, cards, clock })
    const owner = { actorTelegramId: OWNER_TG, businessId: "biz-1" }

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        cards = new InMemoryPayoutCards()
        await businesses.save(makeBusiness({ card: false }))
    })

    it("the owner adds cards, chooses which one customers see, removes the others", async () => {
        const add = new AddPayoutCardUseCase(deps())
        let list = await add.execute({ ...owner, ...FIRST })
        expect(list.cards).toHaveLength(1)
        expect(list.paymentCardId).toBe(list.cards[0]?.id)
        list = await add.execute({
            ...owner,
            number: "5614 6812 3456 7893",
            holder: " Rustam  Karimov ",
        })
        expect(list.cards[1]).toMatchObject({ number: SECOND.number, holder: "Rustam Karimov" })
        const second = list.cards[1]?.id ?? ""

        list = await new ChoosePaymentCardUseCase(deps()).execute({ ...owner, cardId: second })
        expect(list.paymentCardId).toBe(second)
        expect((await businesses.findById("biz-1"))?.payoutCard?.number).toBe(SECOND.number)

        const remove = new RemovePayoutCardUseCase(deps())
        await expect(remove.execute({ ...owner, cardId: second })).rejects.toThrow(
            BusinessRuleViolationError,
        )
        list = await remove.execute({ ...owner, cardId: list.cards[0]?.id ?? "" })
        expect(list.cards.map((c) => c.id)).toEqual([second])
        expect(
            (await new ListPayoutCardsUseCase(deps()).execute(owner)).cards.map((c) => c.id),
        ).toEqual([second])
    })

    it("only the owner; a typo in the number is refused", async () => {
        await expect(
            new ListPayoutCardsUseCase(deps()).execute({ ...owner, actorTelegramId: STRANGER_TG }),
        ).rejects.toThrow(ForbiddenError)
        await expect(
            new AddPayoutCardUseCase(deps()).execute({
                ...owner,
                number: "4111111111111112",
                holder: "R",
            }),
        ).rejects.toThrow(ValidationError)
    })

    it("an order keeps the card it was shown; a later switch does not change it", async () => {
        const products = new InMemoryProducts()
        const customers = new InMemoryCustomers()
        const orders = new InMemoryOrders()
        await products.save(makeProduct())
        await customers.save(makeCustomer())
        await customers.sharePhoneWith("cust-1", "biz-1", NOW)
        const add = new AddPayoutCardUseCase(deps())
        await add.execute({ ...owner, ...FIRST })
        const list = await add.execute({ ...owner, ...THIRD })
        const place = new PlaceOrderUseCase({
            businesses,
            products,
            customers,
            orders,
            clock: fixedClock(new Date("2026-09-28T07:00:00Z")),
        })
        const input = {
            user: { id: CUSTOMER_TG, firstName: "Aziz" },
            businessId: "biz-1",
            items: [{ productId: "prod-1", quantity: 1 }],
            address: "Navoiy 12",
        }
        const before = await place.execute(input)
        expect(before.payment.card).toEqual(FIRST)

        await new ChoosePaymentCardUseCase(deps()).execute({
            ...owner,
            cardId: list.cards[1]?.id ?? "",
        })
        const after = await place.execute(input)
        expect(after.payment.card).toEqual(THIRD)
        expect((await orders.findById(before.id))?.payment.card?.number).toBe(FIRST.number)
    })
})

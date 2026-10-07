import { describe, expect, it } from "vitest"

import { OrderItem } from "../../../domain/entities/order-item.js"
import { Product } from "../../../domain/entities/product.js"
import { Language } from "../../../domain/enums/language.js"
import { Unit } from "../../../domain/enums/unit.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { Phone } from "../../../domain/value-objects/phone.js"
import { makeCustomer, makeProduct } from "../../fixtures.js"

describe("Product", () => {
    it("is created available with an integer price", () => {
        const product = makeProduct()
        expect(product.isAvailable).toBe(true)
        expect(product.price.amount).toBe(35_000)
        expect(product.unit).toBe(Unit.PORTION)
        expect(product.category).toBe("meals")
        expect(product.position).toBe(0)
        expect(product.belongsTo("biz-1")).toBe(true)
        expect(product.belongsTo("biz-2")).toBe(false)
    })

    it("rejects invalid data", () => {
        expect(() => makeProduct({ price: 0 })).toThrow(ValidationError)
        expect(() => makeProduct({ price: 10.5 })).toThrow(ValidationError)
        expect(() => makeProduct({ name: " " })).toThrow(ValidationError)
    })

    it("updates fields, availability and image", () => {
        const product = makeProduct()
        product.update({
            name: "Osh (katta)",
            description: "Samarqand oshi",
            price: 45_000,
            unit: Unit.PIECE,
            category: "grill",
            position: 3,
        })
        expect(product.name).toBe("Osh (katta)")
        expect(product.description).toBe("Samarqand oshi")
        expect(product.price.amount).toBe(45_000)
        expect(product.unit).toBe(Unit.PIECE)
        expect(product.category).toBe("grill")
        expect(product.position).toBe(3)

        product.update({ description: null })
        expect(product.description).toBeUndefined()

        product.setAvailability(false)
        expect(product.isAvailable).toBe(false)

        product.setImage("products/1.webp")
        expect(product.imageKey).toBe("products/1.webp")
        product.setImage(null)
        expect(product.imageKey).toBeUndefined()

        expect(() => product.update({ unit: "ton" })).toThrow(ValidationError)
        expect(() => product.update({ category: "cars" })).toThrow(ValidationError)
    })
})

describe("Product for grocery and water", () => {
    const NOON = new Date("2026-09-28T07:00:00Z") // 12:00 in Tashkent

    function kg(step?: number): Product {
        return Product.create({
            id: "p-kg",
            businessId: "biz-1",
            name: "Pomidor",
            price: 12_000,
            unit: Unit.KG,
            category: "produce",
            step,
        })
    }

    it("weight items sell in gram steps; pieces always step 1", () => {
        expect(kg().step).toBe(500)
        expect(kg(250).step).toBe(250)
        expect(makeProduct().step).toBe(1)
        expect(() => kg(5)).toThrow(ValidationError)
    })

    it("checks quantities against the step", () => {
        const tomatoes = kg()
        tomatoes.assertQuantity(1500)
        expect(() => tomatoes.assertQuantity(700)).toThrow(ValidationError)
        expect(() => tomatoes.assertQuantity(0)).toThrow(ValidationError)
        expect(() => tomatoes.assertQuantity(500 * 100)).toThrow(ValidationError)
        makeProduct().assertQuantity(99)
        expect(() => makeProduct().assertQuantity(100)).toThrow(ValidationError)
    })

    it("switching the unit resets or keeps the step sensibly", () => {
        const product = makeProduct()
        product.update({ unit: Unit.KG })
        expect(product.step).toBe(500)
        product.update({ step: 250 })
        expect(product.step).toBe(250)
        product.update({ name: "Olma" })
        expect(product.step).toBe(250)
        product.update({ unit: Unit.PIECE })
        expect(product.step).toBe(1)
    })

    it("sells by 100 g and by the gram: 300 g of pepper at 6 000 per 100 g is 18 000", () => {
        const pepper = Product.create({
            id: "p-pepper",
            businessId: "biz-1",
            name: "Qora murch",
            price: 6_000,
            unit: Unit.G100,
            category: "spices",
        })
        expect(pepper.step).toBe(100)
        pepper.assertQuantity(300)
        expect(() => pepper.assertQuantity(150)).toThrow(ValidationError)
        const line = OrderItem.create({
            productId: pepper.id,
            name: pepper.name,
            unit: pepper.unit,
            category: pepper.category,
            unitPrice: pepper.price,
            quantity: 300,
        })
        expect(line.total.amount).toBe(18_000)

        const saffron = Product.create({
            id: "p-saffron",
            businessId: "biz-1",
            name: "Zafaron",
            price: 45_000,
            unit: Unit.GRAM,
            category: "spices",
        })
        expect(saffron.step).toBe(1)
        saffron.assertQuantity(2)
        const two = OrderItem.create({
            productId: saffron.id,
            name: saffron.name,
            unit: saffron.unit,
            category: saffron.category,
            unitPrice: saffron.price,
            quantity: 2,
        })
        expect(two.total.amount).toBe(90_000)
    })

    it("measures and time sell by whole units: 12 m² of carpet, 3 hours", () => {
        const carpet = Product.create({
            id: "p-carpet",
            businessId: "biz-1",
            name: "Gilam yuvish",
            price: 12_000,
            unit: Unit.SQUARE_METRE,
            category: "carpet",
            step: 500,
        })
        expect(carpet.step).toBe(1)
        carpet.assertQuantity(12)
        const line = OrderItem.create({
            productId: carpet.id,
            name: carpet.name,
            unit: carpet.unit,
            category: carpet.category,
            unitPrice: carpet.price,
            quantity: 12,
        })
        expect(line.total.amount).toBe(144_000)
    })

    it("stop-list for today ends at the next Tashkent midnight", () => {
        const product = makeProduct()
        product.stopForToday(NOON)
        expect(product.isAvailableAt(NOON)).toBe(false)
        expect(product.unavailableUntil?.toISOString()).toBe("2026-09-28T19:00:00.000Z")
        expect(product.isAvailableAt(new Date("2026-09-28T19:00:00Z"))).toBe(true)
        product.setAvailability(true)
        expect(product.unavailableUntil).toBeUndefined()
        product.setAvailability(false)
        expect(product.isAvailableAt(NOON)).toBe(false)
    })

    it("marks returnable bottles", () => {
        const bottle = Product.create({
            id: "w1",
            businessId: "biz-1",
            name: "Suv 19 l",
            price: 15_000,
            unit: Unit.BOTTLE_19L,
            category: "water",
            returnable: true,
        })
        expect(bottle.returnable).toBe(true)
        bottle.update({ returnable: false })
        expect(bottle.returnable).toBe(false)
    })
})

describe("Customer", () => {
    it("registers without a phone", () => {
        const customer = makeCustomer({ withPhone: false })
        expect(customer.hasPhone()).toBe(false)
        expect(customer.name).toBe("Aziz")
        expect(customer.language).toBe(Language.UZ)
    })

    it("updates name, phone and language", () => {
        const customer = makeCustomer({ withPhone: false })
        customer.rename("Aziz Karimov")
        customer.setPhone(Phone.create("998901112233"))
        customer.setLanguage(Language.UZ)
        expect(customer.name).toBe("Aziz Karimov")
        expect(customer.phone?.number).toBe("+998901112233")
        expect(customer.language).toBe(Language.UZ)
        expect(() => customer.rename("")).toThrow(ValidationError)
    })
})

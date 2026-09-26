import { describe, expect, it } from "vitest"

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
        customer.setLanguage(Language.RU)
        expect(customer.name).toBe("Aziz Karimov")
        expect(customer.phone?.number).toBe("+998901112233")
        expect(customer.language).toBe(Language.RU)
        expect(() => customer.rename("")).toThrow(ValidationError)
    })
})

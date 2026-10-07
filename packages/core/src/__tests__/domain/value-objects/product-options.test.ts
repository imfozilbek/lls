import { describe, expect, it } from "vitest"

import { Product } from "../../../domain/entities/product.js"
import { Unit } from "../../../domain/enums/unit.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { Money } from "../../../domain/value-objects/money.js"
import { ProductOptions } from "../../../domain/value-objects/product-options.js"

const LATTE = {
    group: "Hajmi",
    variants: [
        { id: "s", name: "0,3 l", price: 15_000 },
        { id: "m", name: "0,4 l", price: 18_000 },
        { id: "l", name: "0,5 l", price: 22_000 },
    ],
    addons: [
        { id: "syrup", name: "Karamel sirop", price: 4_000 },
        { id: "nosugar", name: "Shakarsiz", price: 0 },
    ],
}

function latte(): Product {
    return Product.create({
        id: "p-latte",
        businessId: "biz-1",
        name: "Latte",
        price: 99_999,
        unit: Unit.PIECE,
        category: "coffee",
        options: LATTE,
    })
}

describe("ProductOptions", () => {
    it("prices a pick: the variant's price plus the add-ons, with the words for the order", () => {
        const options = ProductOptions.create(LATTE)
        const picked = options.price(Money.of(15_000), {
            variantId: "m",
            addonIds: ["syrup", "nosugar", "syrup"],
        })
        expect(picked?.unitPrice.amount).toBe(22_000)
        expect(picked?.chosen).toEqual({
            variantId: "m",
            addonIds: ["nosugar", "syrup"],
            label: "0,4 l · Karamel sirop, Shakarsiz",
        })
        expect(options.lowestPrice).toBe(15_000)
    })

    it("refuses a pick that does not fit: no variant, or an id it does not have", () => {
        const options = ProductOptions.create(LATTE)
        expect(options.price(Money.of(1), {})).toBeNull()
        expect(options.price(Money.of(1), { variantId: "xl" })).toBeNull()
        expect(options.price(Money.of(1), { variantId: "s", addonIds: ["honey"] })).toBeNull()
    })

    it("add-ons alone keep the base price; nothing picked is the plain product", () => {
        const options = ProductOptions.create({ variants: [], addons: LATTE.addons })
        expect(options.price(Money.of(10_000), {})).toEqual({ unitPrice: Money.of(10_000) })
        expect(options.price(Money.of(10_000), { addonIds: ["syrup"] })?.unitPrice.amount).toBe(
            14_000,
        )
    })

    it("checks names, prices, ids and limits", () => {
        const one = { variants: [{ id: "a", name: "Bitta", price: 1 }], addons: [] }
        expect(() => ProductOptions.create(one)).toThrow(ValidationError)
        const twin = {
            variants: [
                { id: "a", name: "Kichik", price: 1 },
                { id: "a", name: "Katta", price: 2 },
            ],
            addons: [],
        }
        expect(() => ProductOptions.create(twin)).toThrow(ValidationError)
        const free = {
            variants: [
                { id: "a", name: "Kichik", price: 0 },
                { id: "b", name: "Katta", price: 2 },
            ],
            addons: [],
        }
        expect(() => ProductOptions.create(free)).toThrow(ValidationError)
        const many = Array.from({ length: 16 }, (_, i) => ({
            id: `a${i}`,
            name: `Q${i}`,
            price: 0,
        }))
        expect(() => ProductOptions.create({ variants: [], addons: many })).toThrow(ValidationError)
        const badId = { variants: [], addons: [{ id: "A B", name: "Sous", price: 0 }] }
        expect(() => ProductOptions.create(badId)).toThrow(ValidationError)
    })
})

describe("a product with variants and add-ons", () => {
    it("costs as its cheapest variant and prices the customer's pick", () => {
        const product = latte()
        expect(product.price.amount).toBe(15_000)
        expect(product.priceFor({ variantId: "l", addonIds: ["syrup"] }).unitPrice.amount).toBe(
            26_000,
        )
    })

    it("asks for a variant and refuses an unknown option", () => {
        const product = latte()
        expect(() => product.priceFor({})).toThrow(BusinessRuleViolationError)
        expect(() => product.priceFor({ variantId: "xl" })).toThrow(BusinessRuleViolationError)
        const plain = Product.create({
            id: "p-tea",
            businessId: "biz-1",
            name: "Choy",
            price: 5_000,
            unit: Unit.PIECE,
            category: "tea",
        })
        expect(() => plain.priceFor({ variantId: "s" })).toThrow(BusinessRuleViolationError)
        expect(plain.priceFor({}).unitPrice.amount).toBe(5_000)
    })

    it("a weight item takes variants but no add-ons", () => {
        const rice = (addons: typeof LATTE.addons): Product =>
            Product.create({
                id: "p-rice",
                businessId: "biz-1",
                name: "Guruch",
                price: 1,
                unit: Unit.KG,
                category: "rice",
                options: { variants: LATTE.variants, addons },
            })
        expect(rice([]).price.amount).toBe(15_000)
        expect(() => rice(LATTE.addons)).toThrow(ValidationError)
    })

    it("new options move the price; null drops them and keeps the price", () => {
        const product = latte()
        product.update({
            options: {
                variants: [
                    { id: "s", name: "0,3 l", price: 16_000 },
                    { id: "m", name: "0,4 l", price: 19_000 },
                ],
                addons: [],
            },
        })
        expect(product.price.amount).toBe(16_000)
        product.update({ options: null, price: 17_000 })
        expect(product.options).toBeUndefined()
        expect(product.price.amount).toBe(17_000)
        expect(() => latte().update({ unit: Unit.KG })).toThrow(ValidationError)
    })
})

import { beforeEach, describe, expect, it } from "vitest"

import { toProductDTO } from "../../application/dtos/product.dto.js"
import { CancelOrderUseCase } from "../../application/use-cases/order/order.use-cases.js"
import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import {
    ListProductsUseCase,
    UpdateProductUseCase,
} from "../../application/use-cases/product/product.use-cases.js"
import { Product } from "../../domain/entities/product.js"
import { Unit } from "../../domain/enums/unit.js"
import { ValidationError } from "../../domain/errors/validation.error.js"
import {
    CUSTOMER_TG,
    NOON_MONDAY_UZ,
    OWNER_TG,
    PIN,
    makeBusiness,
    makeCustomer,
} from "../fixtures.js"
import {
    InMemoryBusinesses,
    InMemoryCouriers,
    InMemoryCustomers,
    InMemoryOrders,
    InMemoryProducts,
    fixedClock,
} from "../in-memory.js"

import type { OrderLineInput } from "../../application/use-cases/order/place-order.use-case.js"

/** A T-shirt in two sizes, three left in all (owner's decision: one count for every variant). */
function tShirt(stock: number | null = 3): Product {
    return Product.create({
        id: "shirt",
        businessId: "biz-1",
        name: "Futbolka",
        price: 90_000,
        unit: Unit.PIECE,
        category: "clothes",
        stock,
        options: {
            group: "O'lchami",
            variants: [
                { id: "s", name: "S", price: 90_000 },
                { id: "m", name: "M", price: 95_000 },
            ],
            addons: [],
        },
    })
}

describe("the shop's stock (owner's decision, November 2026)", () => {
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts
    let customers: InMemoryCustomers
    let orders: InMemoryOrders

    const place = (items: OrderLineInput[]): ReturnType<PlaceOrderUseCase["execute"]> =>
        new PlaceOrderUseCase({
            businesses,
            products,
            customers,
            orders,
            clock: fixedClock(NOON_MONDAY_UZ),
        }).execute({
            user: { id: CUSTOMER_TG, firstName: "Aziz" },
            businessId: "biz-1",
            items,
            address: "Navoiy 12",
            location: PIN,
        })

    const stockOf = (id = "shirt"): number | undefined => products.items.get(id)?.stock

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        products = new InMemoryProducts()
        customers = new InMemoryCustomers()
        orders = new InMemoryOrders(businesses, products)
        await businesses.save(makeBusiness())
        await products.save(tShirt())
        await customers.save(makeCustomer())
        await customers.sharePhoneWith("cust-1", "biz-1", NOON_MONDAY_UZ)
    })

    it("an order takes from it; every variant counts against the one number", async () => {
        await expect(
            place([
                { productId: "shirt", variantId: "s", quantity: 2 },
                { productId: "shirt", variantId: "m", quantity: 2 },
            ]),
        ).rejects.toMatchObject({ rule: "OUT_OF_STOCK", details: { productId: "shirt", left: 3 } })
        expect(stockOf()).toBe(3)
        expect(orders.items.size).toBe(0)

        await place([
            { productId: "shirt", variantId: "s", quantity: 2 },
            { productId: "shirt", variantId: "m", quantity: 1 },
        ])
        expect(stockOf()).toBe(0)
        expect(products.items.get("shirt")?.soldOut).toBe(true)
        await expect(
            place([{ productId: "shirt", variantId: "s", quantity: 1 }]),
        ).rejects.toMatchObject({ rule: "OUT_OF_STOCK", details: { left: 0 } })
    })

    it("a cancel gives it back once; a product not counted is sold as before", async () => {
        const order = await place([{ productId: "shirt", variantId: "s", quantity: 2 }])
        expect(stockOf()).toBe(1)
        const cancel = new CancelOrderUseCase({
            businesses,
            customers,
            couriers: new InMemoryCouriers(),
            orders,
        })
        await cancel.execute({ businessId: "biz-1", telegramId: CUSTOMER_TG, orderId: order.id })
        expect(stockOf()).toBe(3)
        // Saved again after the cancel: nothing more comes back.
        const stored = orders.items.get(order.id)
        if (stored) {
            await orders.save(stored)
        }
        expect(stockOf()).toBe(3)

        await products.save(tShirt(null))
        await place([{ productId: "shirt", variantId: "s", quantity: 50 }])
        expect(stockOf()).toBeUndefined()
    })

    it("two customers and the last piece: the second hears how many are left", async () => {
        await products.save(tShirt(1))
        // The first order is placed while the second is being checked: the count went down.
        const first = place([{ productId: "shirt", variantId: "s", quantity: 1 }])
        const second = place([{ productId: "shirt", variantId: "m", quantity: 1 }])
        const results = await Promise.allSettled([first, second])
        expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"])
        const refused = results.find((r) => r.status === "rejected")
        expect(refused?.status === "rejected" ? refused.reason : null).toMatchObject({
            rule: "OUT_OF_STOCK",
            details: { left: 0 },
        })
        expect(stockOf()).toBe(0)
        expect(orders.items.size).toBe(1)
    })

    it("a weight product is gone when less than one step is left", () => {
        const rice = Product.create({
            id: "rice",
            businessId: "biz-1",
            name: "Guruch",
            price: 18_000,
            unit: Unit.KG,
            category: "rice",
            step: 500,
            stock: 400,
        })
        expect(rice.soldOut).toBe(true)
        rice.update({ stock: 2_500 })
        expect(rice.soldOut).toBe(false)
        expect(() => rice.assertInStock(3_000)).toThrow(/left/)
        expect(() => rice.update({ stock: -1 })).toThrow(ValidationError)
        expect(() => rice.update({ stock: 1.5 })).toThrow(ValidationError)
    })

    it("the owner sees the count, a customer only that it is gone", async () => {
        await products.save(tShirt(0))
        const list = new ListProductsUseCase(businesses, products, fixedClock(NOON_MONDAY_UZ))
        const shop = await list.execute({
            businessId: "biz-1",
            audience: "customer",
            actorTelegramId: CUSTOMER_TG,
        })
        expect(shop.data[0]).toMatchObject({ soldOut: true })
        expect(shop.data[0]).not.toHaveProperty("stock")
        const owner = await list.execute({
            businessId: "biz-1",
            audience: "owner",
            actorTelegramId: OWNER_TG,
        })
        expect(owner.data[0]).toMatchObject({ stock: 0, soldOut: true })
        expect(toProductDTO(tShirt(null))).not.toHaveProperty("soldOut")
    })

    it("a plain edit keeps the count the orders changed; a new count is the owner's", async () => {
        const fresh = tShirt()
        expect(fresh.stockChanged).toBe(true)
        const stored = Product.reconstitute({
            id: "p",
            businessId: "biz-1",
            name: "Kubik",
            price: tShirt().price,
            unit: Unit.PIECE,
            step: 1,
            category: "logic_games",
            isAvailable: true,
            returnable: false,
            position: 0,
            stock: 4,
            createdAt: NOON_MONDAY_UZ,
            updatedAt: NOON_MONDAY_UZ,
        })
        stored.update({ name: "Mantiqiy kubik" })
        expect(stored.stockChanged).toBe(false)
        const update = new UpdateProductUseCase(businesses, products, fixedClock(NOON_MONDAY_UZ))
        const saved = await update.execute({
            businessId: "biz-1",
            actorTelegramId: OWNER_TG,
            productId: "shirt",
            patch: { stock: 10 },
        })
        expect(saved.stock).toBe(10)
        expect(products.items.get("shirt")?.stockChanged).toBe(true)
    })
})

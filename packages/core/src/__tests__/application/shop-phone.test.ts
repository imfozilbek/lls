import { describe, expect, it } from "vitest"

import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import { GetShopBySlugUseCase } from "../../application/use-cases/shop/get-shop.use-case.js"
import { shopCallPhone } from "../../application/use-cases/shop/shop-phone.js"
import { Customer } from "../../domain/entities/customer.js"
import { Language } from "../../domain/enums/language.js"
import { Phone } from "../../domain/value-objects/phone.js"
import { TelegramId } from "../../domain/value-objects/telegram-id.js"
import {
    CUSTOMER_TG,
    NOON_MONDAY_UZ,
    OWNER_TG,
    SHOP_PHONE,
    makeBusiness,
    makeCustomer,
    makeProduct,
} from "../fixtures.js"
import {
    InMemoryBusinesses,
    InMemoryCustomers,
    InMemoryOrders,
    InMemoryProducts,
    fixedClock,
} from "../in-memory.js"

import type { Business } from "../../domain/entities/business.js"

const OWNER_PHONE = "+998905550001"
const clock = fixedClock(NOON_MONDAY_UZ)

/** The owner as Zumda knows them: their own Telegram, with the phone they shared, if any. */
async function ownerAsCustomer(customers: InMemoryCustomers, phone?: string): Promise<void> {
    const owner = Customer.register({
        id: "owner",
        telegramId: TelegramId.create(OWNER_TG),
        name: "Rustam",
        language: Language.UZ,
    })
    if (phone) {
        owner.setPhone(Phone.create(phone))
    }
    await customers.save(owner)
}

/** The fixture customer, with the phone sent to this shop, orders one product. */
async function order(shop: Business): Promise<unknown> {
    const businesses = new InMemoryBusinesses()
    const products = new InMemoryProducts()
    const customers = new InMemoryCustomers()
    await businesses.save(shop)
    await products.save(makeProduct())
    await customers.save(makeCustomer())
    await customers.sharePhoneWith("cust-1", shop.id, NOON_MONDAY_UZ)
    const place = new PlaceOrderUseCase({
        businesses,
        products,
        customers,
        orders: new InMemoryOrders(),
        clock,
    })
    return place.execute({
        user: { id: CUSTOMER_TG, firstName: "Aziz" },
        businessId: shop.id,
        items: [{ productId: "prod-1", quantity: 1 }],
        address: "Navoiy 12",
    })
}

describe("the number to call the shop on", () => {
    it("is the shop's own number when the owner gave one", async () => {
        const customers = new InMemoryCustomers()
        await ownerAsCustomer(customers, OWNER_PHONE)
        expect((await shopCallPhone(makeBusiness(), customers))?.number).toBe(SHOP_PHONE)
    })

    it("is the owner's own phone while the shop has none; none when neither", async () => {
        const customers = new InMemoryCustomers()
        const shop = makeBusiness({ phone: false })
        expect(await shopCallPhone(shop, customers)).toBeUndefined()
        await ownerAsCustomer(customers)
        expect(await shopCallPhone(shop, customers)).toBeUndefined()
        await ownerAsCustomer(customers, OWNER_PHONE)
        expect((await shopCallPhone(shop, customers))?.number).toBe(OWNER_PHONE)
    })

    it("comes with the opened storefront; the owner's form keeps its own field", async () => {
        const businesses = new InMemoryBusinesses()
        const customers = new InMemoryCustomers()
        await businesses.save(makeBusiness({ phone: false }))
        await ownerAsCustomer(customers, OWNER_PHONE)
        const shop = await new GetShopBySlugUseCase(businesses, clock, customers).execute(
            "osh-markaz",
        )
        expect(shop.callPhone).toBe(OWNER_PHONE)
        expect(shop.contactPhone).toBeUndefined()
        expect(shop.paymentMethods).not.toHaveLength(0)
    })
})

describe("no phone, no orders (owner's decision, October 2026)", () => {
    it("a shop with no number of its own or the owner's takes no orders", async () => {
        await expect(order(makeBusiness({ phone: false }))).rejects.toMatchObject({
            rule: "NO_SHOP_PHONE",
        })
        await expect(order(makeBusiness())).resolves.toMatchObject({ status: "pending" })
    })

    it("its storefront offers no way to order yet: «Tez orada…»", async () => {
        const businesses = new InMemoryBusinesses()
        await businesses.save(makeBusiness({ phone: false }))
        const shop = await new GetShopBySlugUseCase(
            businesses,
            clock,
            new InMemoryCustomers(),
        ).execute("osh-markaz")
        expect(shop.callPhone).toBeUndefined()
        expect(shop.paymentMethods).toEqual([])
    })

    it("a demo's orders are not real: it takes them without a number", async () => {
        const demo = makeBusiness({ phone: false })
        demo.makeDemo(NOON_MONDAY_UZ)
        await expect(order(demo)).resolves.toMatchObject({ status: "pending" })
    })
})

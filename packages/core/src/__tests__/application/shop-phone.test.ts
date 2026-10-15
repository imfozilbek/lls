import { describe, expect, it } from "vitest"

import { GetShopBySlugUseCase } from "../../application/use-cases/shop/get-shop.use-case.js"
import { shopCallPhone } from "../../application/use-cases/shop/shop-phone.js"
import { Customer } from "../../domain/entities/customer.js"
import { Language } from "../../domain/enums/language.js"
import { Phone } from "../../domain/value-objects/phone.js"
import { TelegramId } from "../../domain/value-objects/telegram-id.js"
import { NOON_MONDAY_UZ, OWNER_TG, makeBusiness } from "../fixtures.js"
import { InMemoryBusinesses, InMemoryCustomers, fixedClock } from "../in-memory.js"

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

describe("the number to call the shop on", () => {
    it("is the shop's own number when the owner gave one", async () => {
        const customers = new InMemoryCustomers()
        await ownerAsCustomer(customers, "+998905550001")
        const shop = makeBusiness()
        shop.updateProfile({ contactPhone: Phone.create("+998901234501") })
        expect((await shopCallPhone(shop, customers))?.number).toBe("+998901234501")
    })

    it("is the owner's own phone while the shop has none; none when neither", async () => {
        const customers = new InMemoryCustomers()
        expect(await shopCallPhone(makeBusiness(), customers)).toBeUndefined()
        await ownerAsCustomer(customers)
        expect(await shopCallPhone(makeBusiness(), customers)).toBeUndefined()
        await ownerAsCustomer(customers, "+998905550001")
        expect((await shopCallPhone(makeBusiness(), customers))?.number).toBe("+998905550001")
    })

    it("comes with the opened storefront; the owner's form keeps its own field", async () => {
        const businesses = new InMemoryBusinesses()
        const customers = new InMemoryCustomers()
        await businesses.save(makeBusiness())
        await ownerAsCustomer(customers, "+998905550001")
        const getShop = new GetShopBySlugUseCase(businesses, fixedClock(NOON_MONDAY_UZ), customers)
        const shop = await getShop.execute("osh-markaz")
        expect(shop.callPhone).toBe("+998905550001")
        expect(shop.contactPhone).toBeUndefined()
    })
})

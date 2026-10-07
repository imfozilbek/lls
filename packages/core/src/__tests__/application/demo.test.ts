import { beforeEach, describe, expect, it } from "vitest"

import { DEMO_CARD, demoTemplate } from "../../application/demo/demo-templates.js"
import {
    MakeDemoShopUseCase,
    ResetDemoShopUseCase,
} from "../../application/use-cases/demo/demo.use-cases.js"
import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import { BusinessRuleViolationError } from "../../domain/errors/business-rule.error.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { CUSTOMER_TG, OWNER_TG, makeBusiness, makeCustomer, makeProduct } from "../fixtures.js"
import {
    InMemoryBusinesses,
    InMemoryCouriers,
    InMemoryCustomers,
    InMemoryOrders,
    InMemoryPayoutCards,
    InMemoryProducts,
    fixedClock,
} from "../in-memory.js"

import type { DemoShopDeps } from "../../application/use-cases/demo/demo.use-cases.js"

const ADMIN_TG = 9999
const NOW = new Date("2026-10-07T07:00:00Z")

describe("demo shops («Namuna»)", () => {
    let deps: DemoShopDeps & {
        businesses: InMemoryBusinesses
        products: InMemoryProducts
        cards: InMemoryPayoutCards
        couriers: InMemoryCouriers
        orders: InMemoryOrders
    }
    const admin = { actorTelegramId: ADMIN_TG, businessId: "biz-1", template: "food" as const }

    beforeEach(async () => {
        const cards = new InMemoryPayoutCards()
        deps = {
            businesses: new InMemoryBusinesses(cards),
            products: new InMemoryProducts(),
            cards,
            couriers: new InMemoryCouriers(),
            orders: new InMemoryOrders(),
            clock: fixedClock(NOW),
            platformAdminIds: [ADMIN_TG],
        }
        const shop = makeBusiness()
        shop.joinMarketplace(500, NOW)
        shop.setDistrict("district-1")
        await deps.businesses.save(shop)
        // The owner added one dish before the shop became a demo: it stays, never doubled.
        await deps.products.save(makeProduct({ name: "To'y oshi" }))
    })

    it("a live shop becomes a demo: sample catalog, test card, owner as courier, no network", async () => {
        const shop = await new MakeDemoShopUseCase(deps).execute(admin)
        expect(shop).toMatchObject({ demo: true, inDistrict: false, payoutCard: DEMO_CARD })
        const business = await deps.businesses.findById("biz-1")
        expect(business?.isDemo()).toBe(true)
        expect(business?.isInShowcase()).toBe(false)
        expect(business?.networkDelivery).toBe(false)
        expect(business?.districtId).toBeUndefined()
        expect(business?.payoutCard?.number).toBe(DEMO_CARD.number)
        expect(business?.workingHours.toJSON()?.mon).toEqual({ open: "00:00", close: "00:00" })

        const names = [...deps.products.items.values()].map((p) => p.name)
        expect(names.filter((name) => name === "To'y oshi")).toHaveLength(1)
        expect(names).toHaveLength(demoTemplate("food").products.length)
        const courier = await deps.couriers.findByTelegramId("biz-1", OWNER_TG)
        expect(courier?.isActive).toBe(true)

        // A demo never joins the showcase, never gets a district back.
        expect(() => business?.joinMarketplace(500, NOW)).toThrow(BusinessRuleViolationError)
        business?.setDistrict("district-1")
        expect(business?.districtId).toBeUndefined()

        // Done again: nothing doubles, the test card stays the one shown.
        await new MakeDemoShopUseCase(deps).execute(admin)
        expect(deps.products.items.size).toBe(demoTemplate("food").products.length)
        expect((await deps.cards.listByBusiness("biz-1")).length).toBe(1)
    })

    it("only an admin, only a live shop, only a sample of the shop's own kind", async () => {
        const make = new MakeDemoShopUseCase(deps)
        await expect(make.execute({ ...admin, actorTelegramId: OWNER_TG })).rejects.toThrow(
            ForbiddenError,
        )
        await expect(make.execute({ ...admin, template: "store" })).rejects.toMatchObject({
            rule: "DEMO_TEMPLATE_MISMATCH",
        })
        await deps.businesses.save(makeBusiness({ id: "biz-2", active: false }))
        await expect(make.execute({ ...admin, businessId: "biz-2" })).rejects.toMatchObject({
            rule: "SHOP_NOT_ACTIVE",
        })
        await expect(
            new ResetDemoShopUseCase(deps).execute({
                actorTelegramId: ADMIN_TG,
                businessId: "biz-1",
            }),
        ).rejects.toMatchObject({ rule: "NOT_A_DEMO" })
    })

    it("«Namunani tozalash»: the orders go, the catalog is the sample's again", async () => {
        await new MakeDemoShopUseCase(deps).execute(admin)
        const customers = new InMemoryCustomers()
        await customers.save(makeCustomer())
        await customers.sharePhoneWith("cust-1", "biz-1", NOW)
        const dish = [...deps.products.items.values()][0]
        await new PlaceOrderUseCase({ ...deps, customers }).execute({
            user: { id: CUSTOMER_TG, firstName: "Aziz" },
            businessId: "biz-1",
            items: [{ productId: dish?.id ?? "", quantity: 1 }],
            address: "Navoiy 12",
        })
        expect(deps.orders.items.size).toBe(1)
        await deps.products.save(makeProduct({ id: "extra", name: "Qo'shimcha" }))

        await new ResetDemoShopUseCase(deps).execute({
            actorTelegramId: ADMIN_TG,
            businessId: "biz-1",
        })
        expect(deps.orders.items.size).toBe(0)
        const names = [...deps.products.items.values()].map((p) => p.name).sort()
        expect(names).toEqual(
            demoTemplate("food")
                .products.map((p) => p.name)
                .sort(),
        )
        expect((await deps.businesses.findById("biz-1"))?.payoutCard?.number).toBe(DEMO_CARD.number)
    })
})

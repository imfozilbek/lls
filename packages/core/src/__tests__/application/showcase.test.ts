import { beforeEach, describe, expect, it } from "vitest"

import {
    ListShowcaseShopsUseCase,
    SearchShowcaseUseCase,
    SetMarketplaceTermsUseCase,
} from "../../application/use-cases/showcase/showcase.use-cases.js"
import { Business } from "../../domain/entities/business.js"
import { Product } from "../../domain/entities/product.js"
import { BusinessType } from "../../domain/enums/business-type.js"
import { Unit } from "../../domain/enums/unit.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../domain/errors/not-found.error.js"
import { ValidationError } from "../../domain/errors/validation.error.js"
import { searchText, searchWords } from "../../domain/shared/search-text.js"
import { Money } from "../../domain/value-objects/money.js"
import { Slug } from "../../domain/value-objects/slug.js"
import { TelegramId } from "../../domain/value-objects/telegram-id.js"
import { NOON_MONDAY_UZ, OWNER_TG, STRANGER_TG, makeBusiness } from "../fixtures.js"
import { InMemoryBusinesses, InMemoryProducts, fixedClock } from "../in-memory.js"

const ADMIN_TG = 9999
const clock = fixedClock(NOON_MONDAY_UZ)

function makeShop(id: string, slug: string, name: string): Business {
    const shop = Business.register({
        id,
        slug: Slug.create(slug),
        name,
        type: BusinessType.GROCERY,
        ownerTelegramId: TelegramId.create(OWNER_TG + 1),
        bot: { id: 800 + id.length, username: `${slug.replaceAll("-", "_")}_bot` },
        delivery: { fee: Money.of(5_000) },
    })
    shop.approve()
    return shop
}

function product(id: string, businessId: string, name: string, category = "meals"): Product {
    return Product.create({ id, businessId, name, price: 10_000, unit: Unit.PIECE, category })
}

describe("searchText", () => {
    it("brings Latin, Cyrillic and every apostrophe to one spelling", () => {
        expect(searchText("To'y oshi")).toBe("toy oshi")
        expect(searchText("Toʻy OSHI")).toBe("toy oshi")
        expect(searchText("ош")).toBe("osh")
        expect(searchText("Лагмон")).toBe("lagmon")
        expect(searchText("Lag'mon")).toBe("lagmon")
        expect(searchText("Шашлык", undefined, "(мол гўшти)")).toBe("shashlik mol goshti")
        expect(searchText("Suv 19 l, 1.5")).toBe("suv 19 l 1 5")
    })

    it("splits a query into words and drops punctuation", () => {
        expect(searchWords("  Suv,  19 ")).toEqual(["suv", "19"])
        expect(searchWords("!!!")).toEqual([])
    })
})

describe("LLS showcase", () => {
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts
    let search: SearchShowcaseUseCase

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        products = new InMemoryProducts(businesses)
        search = new SearchShowcaseUseCase(businesses, products, clock)

        const food = makeBusiness()
        food.joinMarketplace(500, NOON_MONDAY_UZ)
        const grocery = makeShop("biz-2", "baraka", "Baraka")
        grocery.joinMarketplace(300, NOON_MONDAY_UZ)
        const water = makeShop("biz-33", "toza-suv", "Toza Suv")
        const pending = makeShop("biz-444", "yangi", "Yangi")
        pending.joinMarketplace(500, NOON_MONDAY_UZ)
        pending.disable()
        for (const shop of [food, grocery, water, pending]) {
            await businesses.insert(shop, "token")
        }
        await products.save(product("p1", "biz-1", "To'y oshi"))
        await products.save(product("p2", "biz-2", "Pomidor", "produce"))
        await products.save(product("p3", "biz-33", "Toza suv 19 l", "water"))
        await products.save(product("p4", "biz-444", "Osh tayyor"))
        await products.save(product("p6", "biz-2", "Mol go'shti", "meat"))
        const stopped = product("p5", "biz-2", "Osh uchun sabzi", "produce")
        stopped.stopForToday(NOON_MONDAY_UZ)
        await products.save(stopped)
    })

    it("finds products of showcase shops only, whatever the alphabet", async () => {
        const found = await search.execute({ text: "ош" })
        expect(found.data.map((p) => p.name)).toEqual(["To'y oshi"])
        expect(found.data[0]?.shop).toMatchObject({ slug: "osh-markaz", name: "Osh Markaz" })
    })

    it("hides shops without a deal, disabled shops and today's stop-list", async () => {
        expect((await search.execute({ text: "suv" })).data).toHaveLength(0)
        // «osh» starts a word in «To'y oshi», but only sits inside «go'shti».
        expect((await search.execute({ text: "osh" })).data.map((p) => p.id)).toEqual(["p1"])
        expect((await search.execute({ text: "gosht" })).data.map((p) => p.id)).toEqual(["p6"])
    })

    it("filters by category and returns nothing for an empty query", async () => {
        const produce = await search.execute({ category: "produce" })
        expect(produce.data.map((p) => p.name)).toEqual(["Pomidor"])
        expect((await search.execute({ text: " , " })).data).toEqual([])
        await expect(search.execute({ category: "cars" })).rejects.toBeInstanceOf(ValidationError)
    })

    it("lists showcase shops, open ones first", async () => {
        const shops = await new ListShowcaseShopsUseCase(businesses, clock).execute()
        expect(shops.map((s) => s.slug).sort()).toEqual(["baraka", "osh-markaz"])
    })

    it("only a platform admin signs or ends a deal", async () => {
        const terms = new SetMarketplaceTermsUseCase(businesses, [ADMIN_TG], clock)
        await expect(
            terms.execute({ actorTelegramId: STRANGER_TG, slug: "toza-suv", commissionBps: 500 }),
        ).rejects.toBeInstanceOf(ForbiddenError)
        await expect(
            terms.execute({ actorTelegramId: ADMIN_TG, slug: "nope", commissionBps: 500 }),
        ).rejects.toBeInstanceOf(EntityNotFoundError)

        const joined = await terms.execute({
            actorTelegramId: ADMIN_TG,
            slug: "toza-suv",
            commissionBps: 400,
        })
        expect(joined.marketplace?.commissionBps).toBe(400)
        expect((await search.execute({ text: "suv" })).data).toHaveLength(1)

        const left = await terms.execute({
            actorTelegramId: ADMIN_TG,
            slug: "toza-suv",
            commissionBps: null,
        })
        expect(left.marketplace).toBeUndefined()
        expect((await search.execute({ text: "suv" })).data).toHaveLength(0)
    })
})

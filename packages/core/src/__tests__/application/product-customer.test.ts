import { beforeEach, describe, expect, it } from "vitest"

import { TRUSTED_SCOPE, shopScope } from "../../application/dtos/identity-scope.js"
import { normalizePage } from "../../application/dtos/pagination.js"
import { displayNameOf } from "../../application/dtos/telegram-user.js"
import {
    ResolveCustomerUseCase,
    SaveContactUseCase,
    UpdateCustomerUseCase,
} from "../../application/use-cases/customer/customer.use-cases.js"
import {
    CreateProductUseCase,
    DeleteProductUseCase,
    ListProductsUseCase,
    UpdateProductUseCase,
} from "../../application/use-cases/product/product.use-cases.js"
import { Language } from "../../domain/enums/language.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../domain/errors/not-found.error.js"
import { ValidationError } from "../../domain/errors/validation.error.js"
import {
    CUSTOMER_TG,
    NOON_MONDAY_UZ,
    OWNER_TG,
    STRANGER_TG,
    makeBusiness,
    makeProduct,
} from "../fixtures.js"
import {
    InMemoryBusinesses,
    InMemoryCustomers,
    InMemoryProducts,
    fixedClock,
} from "../in-memory.js"

describe("product use cases", () => {
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        products = new InMemoryProducts()
        await businesses.save(makeBusiness())
        await businesses.save(makeBusiness({ id: "biz-2" }))
    })

    it("owner creates a product", async () => {
        const product = await new CreateProductUseCase(businesses, products).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            name: "Lag'mon",
            price: 30_000,
            unit: "portion",
            category: "soups",
        })
        expect(product.price).toBe(30_000)
        expect(products.items.size).toBe(1)
    })

    it("strangers cannot create, update or delete", async () => {
        await products.save(makeProduct())
        const target = { actorTelegramId: STRANGER_TG, businessId: "biz-1", productId: "prod-1" }
        await expect(
            new CreateProductUseCase(businesses, products).execute({
                ...target,
                name: "X",
                price: 1,
                unit: "pcs",
                category: "other",
            }),
        ).rejects.toThrow(ForbiddenError)
        await expect(
            new UpdateProductUseCase(businesses, products, fixedClock(NOON_MONDAY_UZ)).execute({
                ...target,
                patch: {},
            }),
        ).rejects.toThrow(ForbiddenError)
        await expect(
            new DeleteProductUseCase(businesses, products).execute(target),
        ).rejects.toThrow(ForbiddenError)
    })

    it("owner of another shop cannot touch this product", async () => {
        await products.save(makeProduct())
        // biz-2 has the same owner in fixtures, so the product lookup must still reject it
        await expect(
            new UpdateProductUseCase(businesses, products, fixedClock(NOON_MONDAY_UZ)).execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-2",
                productId: "prod-1",
                patch: { price: 1 },
            }),
        ).rejects.toThrow(EntityNotFoundError)
    })

    it("updates fields, availability and image", async () => {
        await products.save(makeProduct())
        const updated = await new UpdateProductUseCase(
            businesses,
            products,
            fixedClock(NOON_MONDAY_UZ),
        ).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            productId: "prod-1",
            patch: { price: 40_000, isAvailable: false, imageKey: "p/1.webp" },
        })
        expect(updated).toMatchObject({ price: 40_000, isAvailable: false, imageKey: "p/1.webp" })
    })

    it("delete returns the product for image cleanup", async () => {
        const product = makeProduct()
        product.setImage("p/1.webp")
        await products.save(product)
        const deleted = await new DeleteProductUseCase(businesses, products).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            productId: "prod-1",
        })
        expect(deleted.imageKey).toBe("p/1.webp")
        expect(products.items.size).toBe(0)
    })

    it("customers see only available products; owners see all", async () => {
        const hidden = makeProduct({ id: "prod-2", name: "Somsa" })
        hidden.setAvailability(false)
        await products.save(makeProduct())
        await products.save(hidden)
        const list = new ListProductsUseCase(businesses, products, fixedClock(NOON_MONDAY_UZ))

        const forCustomer = await list.execute({
            businessId: "biz-1",
            audience: "customer",
            actorTelegramId: CUSTOMER_TG,
        })
        expect(forCustomer.data.map((p) => p.id)).toEqual(["prod-1"])
        expect(forCustomer.meta).toEqual({ page: 1, limit: 20, total: 1 })

        const forOwner = await list.execute({
            businessId: "biz-1",
            audience: "owner",
            actorTelegramId: OWNER_TG,
            category: "meals",
        })
        expect(forOwner.meta.total).toBe(2)

        await expect(
            list.execute({ businessId: "biz-1", audience: "owner", actorTelegramId: STRANGER_TG }),
        ).rejects.toThrow(ForbiddenError)
        await expect(
            list.execute({
                businessId: "biz-1",
                audience: "customer",
                actorTelegramId: CUSTOMER_TG,
                category: "cars",
            }),
        ).rejects.toThrow(ValidationError)
    })

    it("an inactive shop's catalog is hidden from customers", async () => {
        await businesses.save(makeBusiness({ id: "biz-3", active: false }))
        const list = new ListProductsUseCase(businesses, products, fixedClock(NOON_MONDAY_UZ))
        await expect(
            list.execute({
                businessId: "biz-3",
                audience: "customer",
                actorTelegramId: CUSTOMER_TG,
            }),
        ).rejects.toThrow(EntityNotFoundError)
    })
})

describe("customer use cases", () => {
    const user = { id: CUSTOMER_TG, firstName: "Aziz", lastName: "Karimov", languageCode: "ru" }

    it("registers once and keeps the name in sync", async () => {
        const customers = new InMemoryCustomers()
        const resolve = new ResolveCustomerUseCase(customers)
        const first = await resolve.execute(user, TRUSTED_SCOPE)
        expect(first.name).toBe("Aziz Karimov")
        // A Russian Telegram still gets the product language: Uzbek.
        expect(first.language).toBe(Language.UZ)
        expect(first.phone).toBeUndefined()

        const renamed = await resolve.execute({ ...user, lastName: undefined }, TRUSTED_SCOPE)
        expect(renamed.id).toBe(first.id)
        expect(renamed.name).toBe("Aziz")
        expect(customers.items.size).toBe(1)

        // A shop-signed identity can be forged by that shop's owner: it never renames.
        const forged = await resolve.execute({ ...user, firstName: "Hacker" }, shopScope("biz-1"))
        expect(forged.name).toBe("Aziz")
    })

    it("two first requests at once end with one customer", async () => {
        const other = new InMemoryCustomers()
        const theirs = await new ResolveCustomerUseCase(other).execute(user, TRUSTED_SCOPE)
        const customers = new InMemoryCustomers()
        // Another request stored the same person between our lookup and our insert.
        customers.registeredMeanwhile = [...other.items.values()][0] ?? null
        const mine = await new ResolveCustomerUseCase(customers).execute(user, TRUSTED_SCOPE)
        expect(mine.id).toBe(theirs.id)
        expect(customers.items.size).toBe(1)
    })

    it("saves a phone from a contact and sets the language", async () => {
        const customers = new InMemoryCustomers()
        const saved = await new SaveContactUseCase(customers).execute({
            user,
            phone: "998901234567",
            now: NOON_MONDAY_UZ,
        })
        expect(saved.phone).toBe("+998901234567")
        const updated = await new UpdateCustomerUseCase(customers).execute({
            user,
            scope: TRUSTED_SCOPE,
            language: "uz",
        })
        expect(updated.language).toBe(Language.UZ)
        await expect(
            new UpdateCustomerUseCase(customers).execute({
                user,
                scope: TRUSTED_SCOPE,
                language: "en",
            }),
        ).rejects.toThrow(ValidationError)
    })

    it("shows a phone to a shop only after it was sent to that shop", async () => {
        const customers = new InMemoryCustomers()
        const contact = new SaveContactUseCase(customers)
        const resolve = new ResolveCustomerUseCase(customers)
        // Shared with the Zumda bot and with shop A.
        await contact.execute({ user, phone: "998901234567", now: NOON_MONDAY_UZ })
        await contact.execute({
            user,
            phone: "998901234567",
            businessId: "shop-a",
            now: NOON_MONDAY_UZ,
        })

        expect((await resolve.execute(user, TRUSTED_SCOPE)).phone).toBe("+998901234567")
        expect((await resolve.execute(user, shopScope("shop-a"))).phone).toBe("+998901234567")
        // Shop B's owner can sign this user id with their own bot token: no phone for them.
        expect((await resolve.execute(user, shopScope("shop-b"))).phone).toBeUndefined()
    })

    it("display name falls back to username, then id", () => {
        expect(displayNameOf({ id: 1, firstName: " ", username: "aziz" })).toBe("aziz")
        expect(displayNameOf({ id: 1, firstName: "" })).toBe("Telegram 1")
    })
})

describe("pagination", () => {
    it("clamps bad input", () => {
        expect(normalizePage()).toEqual({ page: 1, limit: 20 })
        expect(normalizePage({ page: 0, limit: 0 })).toEqual({ page: 1, limit: 20 })
        expect(normalizePage({ page: 3, limit: 500 })).toEqual({ page: 3, limit: 100 })
        expect(normalizePage({ page: 1.5, limit: -1 })).toEqual({ page: 1, limit: 20 })
    })
})

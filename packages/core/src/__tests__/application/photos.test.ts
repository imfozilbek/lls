import { beforeEach, describe, expect, it } from "vitest"

import { toProductDTO } from "../../application/dtos/product.dto.js"
import { ChangeProductPhotosUseCase } from "../../application/use-cases/product/product.use-cases.js"
import { MAX_PHOTOS } from "../../domain/entities/product.js"
import { EntityNotFoundError } from "../../domain/errors/not-found.error.js"
import { ValidationError } from "../../domain/errors/validation.error.js"
import { OWNER_TG, STRANGER_TG, makeBusiness, makeProduct } from "../fixtures.js"
import { InMemoryBusinesses, InMemoryProducts } from "../in-memory.js"

import type { PhotoChange } from "../../application/use-cases/product/product.use-cases.js"

describe("a product's photos (owner's decision, November 2026: up to three)", () => {
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts

    const change = (
        photo: PhotoChange,
        actorTelegramId = OWNER_TG,
    ): ReturnType<ChangeProductPhotosUseCase["execute"]> =>
        new ChangeProductPhotosUseCase(businesses, products).execute({
            actorTelegramId,
            businessId: "biz-1",
            productId: "prod-1",
            change: photo,
        })

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        products = new InMemoryProducts()
        await businesses.save(makeBusiness())
        await products.save(makeProduct())
    })

    it("the first is the main one; the next two come after it; a fourth is refused", async () => {
        expect(await change({ add: "a.webp" })).toMatchObject({ imageKey: "a.webp" })
        // The same file again (a retried upload): nothing changes.
        expect(await change({ add: "a.webp" })).not.toHaveProperty("moreImageKeys")
        await change({ add: "b.webp" })
        const three = await change({ add: "c.webp" })
        expect(three).toMatchObject({ imageKey: "a.webp", moreImageKeys: ["b.webp", "c.webp"] })
        expect(MAX_PHOTOS).toBe(3)
        await expect(change({ add: "d.webp" })).rejects.toMatchObject({
            rule: "TOO_MANY_PHOTOS",
            details: { max: 3 },
        })
    })

    it("the main one taken away: the next becomes main; a new order puts any first", async () => {
        await change({ add: "a.webp" })
        await change({ add: "b.webp" })
        await change({ add: "c.webp" })
        expect(await change({ remove: "a.webp" })).toMatchObject({
            imageKey: "b.webp",
            moreImageKeys: ["c.webp"],
        })
        const reordered = await change({ order: ["c.webp", "b.webp"] })
        expect(reordered).toMatchObject({ imageKey: "c.webp", moreImageKeys: ["b.webp"] })
        await change({ remove: "b.webp" })
        const one = await change({ remove: "c.webp" }).then(() => products.items.get("prod-1"))
        expect(one?.photos).toEqual([])
        expect(one && toProductDTO(one)).not.toHaveProperty("moreImageKeys")
    })

    it("a key that is not this product's, a different set, a stranger: refused", async () => {
        await change({ add: "a.webp" })
        await change({ add: "b.webp" })
        await expect(change({ remove: "x.webp" })).rejects.toBeInstanceOf(EntityNotFoundError)
        await expect(change({ order: ["a.webp"] })).rejects.toBeInstanceOf(ValidationError)
        await expect(change({ order: ["a.webp", "x.webp"] })).rejects.toBeInstanceOf(
            ValidationError,
        )
        await expect(change({ add: "c.webp" }, STRANGER_TG)).rejects.toThrow()
        expect(products.items.get("prod-1")?.photos).toEqual(["a.webp", "b.webp"])
    })

    it("«Rasmni o'chirish» on the main photo of the catalog row promotes the next", () => {
        const product = makeProduct()
        product.addPhoto("a.webp")
        product.addPhoto("b.webp")
        expect(product.setImage(null)).toBe("a.webp")
        expect(product.photos).toEqual(["b.webp"])
        expect(product.setImage("n.webp")).toBe("b.webp")
        expect(product.photos).toEqual(["n.webp"])
    })
})

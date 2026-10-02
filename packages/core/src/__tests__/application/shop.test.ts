import { beforeEach, describe, expect, it } from "vitest"

import {
    GetShopBySlugUseCase,
    ListMyShopsUseCase,
} from "../../application/use-cases/shop/get-shop.use-case.js"
import { RegisterShopUseCase } from "../../application/use-cases/shop/register-shop.use-case.js"
import { ReviewShopUseCase } from "../../application/use-cases/shop/review-shop.use-case.js"
import { UpdateShopUseCase } from "../../application/use-cases/shop/update-shop.use-case.js"
import { BusinessStatus } from "../../domain/enums/business-status.js"
import { BusinessType } from "../../domain/enums/business-type.js"
import { ConflictError } from "../../domain/errors/conflict.error.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../domain/errors/not-found.error.js"
import { NOON_MONDAY_UZ, OWNER_TG, STRANGER_TG, TEST_CARD, makeBusiness } from "../fixtures.js"
import { InMemoryBusinesses, fixedClock } from "../in-memory.js"

import type { RegisterShopInput } from "../../application/use-cases/shop/register-shop.use-case.js"

const ADMIN_TG = 9999
const clock = fixedClock(NOON_MONDAY_UZ)

function registration(overrides: Partial<RegisterShopInput> = {}): RegisterShopInput {
    return {
        ownerTelegramId: OWNER_TG,
        bot: { id: 555, username: "Osh_Markaz_bot", token: "555:secret" },
        name: "Osh Markaz",
        type: BusinessType.FOOD,
        address: "Chorsu",
        location: { latitude: 41.32, longitude: 69.23 },
        deliveryFee: 10_000,
        freeDeliveryFrom: 150_000,
        minOrder: 0,
        payoutCard: TEST_CARD,
        ...overrides,
    }
}

describe("shop use cases", () => {
    let businesses: InMemoryBusinesses

    beforeEach(() => {
        businesses = new InMemoryBusinesses()
    })

    describe("RegisterShop", () => {
        it("creates a pending shop, derives the slug and keeps the token for the adapter", async () => {
            const shop = await new RegisterShopUseCase(businesses, clock).execute(registration())
            expect(shop.status).toBe(BusinessStatus.PENDING)
            expect(shop.slug).toBe("osh-markaz")
            expect(shop.delivery).toEqual({ fee: 10_000, freeFrom: 150_000, minOrder: undefined })
            expect(shop.location).toEqual({ latitude: 41.32, longitude: 69.23 })
            expect(shop.botUsername).toBe("Osh_Markaz_bot")
            expect(businesses.tokens.get(shop.id)).toBe("555:secret")
            expect(shop).not.toHaveProperty("token")
            // The card is a required step: the shop takes transfers from the first order.
            expect(businesses.items.get(shop.id)?.acceptsCardTransfers()).toBe(true)
        })

        it("adds a suffix when the slug is taken", async () => {
            const useCase = new RegisterShopUseCase(businesses, clock)
            await useCase.execute(registration())
            const second = await useCase.execute(
                registration({ bot: { id: 556, username: "osh_markaz_bot", token: "x" } }),
            )
            expect(second.slug).toBe("osh-markaz-2")
        })

        it("rejects a bot that is already connected", async () => {
            const useCase = new RegisterShopUseCase(businesses, clock)
            await useCase.execute(registration())
            await expect(useCase.execute(registration())).rejects.toThrow(ConflictError)
        })
    })

    describe("ReviewShop", () => {
        it("admin approves and rejects; others are forbidden", async () => {
            const business = makeBusiness({ active: false })
            await businesses.save(business)
            const review = new ReviewShopUseCase(businesses, [ADMIN_TG], clock)

            await expect(
                review.execute({
                    actorTelegramId: OWNER_TG,
                    businessId: business.id,
                    decision: "approve",
                }),
            ).rejects.toThrow(ForbiddenError)

            const approved = await review.execute({
                actorTelegramId: ADMIN_TG,
                businessId: business.id,
                decision: "approve",
            })
            expect(approved.status).toBe(BusinessStatus.ACTIVE)

            const rejected = await review.execute({
                actorTelegramId: ADMIN_TG,
                businessId: business.id,
                decision: "reject",
            })
            expect(rejected.status).toBe(BusinessStatus.DISABLED)
        })
    })

    describe("GetShopBySlug and ListMyShops", () => {
        it("hides inactive shops from customers but not from the owner", async () => {
            await businesses.save(makeBusiness({ active: false }))
            const getShop = new GetShopBySlugUseCase(businesses, clock)
            await expect(getShop.execute("osh-markaz", STRANGER_TG)).rejects.toThrow(
                EntityNotFoundError,
            )
            await expect(getShop.execute("osh-markaz")).rejects.toThrow(EntityNotFoundError)
            const preview = await getShop.execute("osh-markaz", OWNER_TG)
            expect(preview.isOpen).toBe(false)
            await expect(getShop.execute("nope")).rejects.toThrow(EntityNotFoundError)
        })

        it("shows an active shop as open", async () => {
            await businesses.save(makeBusiness())
            const shop = await new GetShopBySlugUseCase(businesses, clock).execute("osh-markaz")
            expect(shop.isOpen).toBe(true)
            expect(shop).not.toHaveProperty("ownerTelegramId")
        })

        it("lists only the caller's shops", async () => {
            await businesses.save(makeBusiness())
            const list = new ListMyShopsUseCase(businesses, clock)
            expect(await list.execute(OWNER_TG)).toHaveLength(1)
            expect(await list.execute(STRANGER_TG)).toHaveLength(0)
        })
    })

    describe("UpdateShop", () => {
        it("owner updates settings", async () => {
            await businesses.save(makeBusiness())
            const shop = await new UpdateShopUseCase(businesses, clock).execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                patch: {
                    name: "Osh Markaz №1",
                    brandColor: "#F97316",
                    logoKey: "logos/biz-1.webp",
                    address: null,
                    location: { latitude: 41.3, longitude: 69.2 },
                    delivery: { fee: 5_000, freeFrom: null, minOrder: 30_000, radiusMeters: 4_000 },
                    workingHours: { mon: { open: "10:00", close: "22:00" } },
                    acceptingOrders: false,
                },
            })
            expect(shop.name).toBe("Osh Markaz №1")
            expect(shop.brandColor).toBe("#f97316")
            expect(shop.address).toBeUndefined()
            expect(shop.delivery).toEqual({ fee: 5_000, freeFrom: undefined, minOrder: 30_000 })
            expect(shop.deliveryRadiusMeters).toBe(4_000)
            expect(shop.workingHours).toEqual({ mon: { open: "10:00", close: "22:00" } })
            expect(shop.acceptingOrders).toBe(false)
            expect(shop.isOpen).toBe(false)
        })

        it("can clear location and reset hours to always open", async () => {
            await businesses.save(makeBusiness())
            const shop = await new UpdateShopUseCase(businesses, clock).execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                patch: { location: null, workingHours: null },
            })
            expect(shop.location).toBeUndefined()
            expect(shop.workingHours).toBeNull()
        })

        it("forbids strangers", async () => {
            await businesses.save(makeBusiness())
            await expect(
                new UpdateShopUseCase(businesses, clock).execute({
                    actorTelegramId: STRANGER_TG,
                    businessId: "biz-1",
                    patch: { name: "Hacked" },
                }),
            ).rejects.toThrow(ForbiddenError)
        })
    })
})

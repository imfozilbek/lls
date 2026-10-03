import { beforeEach, describe, expect, it } from "vitest"

import {
    GetShopBySlugUseCase,
    ListMyShopsUseCase,
} from "../../application/use-cases/shop/get-shop.use-case.js"
import {
    ListMyManagedBotsUseCase,
    ManagedBotChangedUseCase,
} from "../../application/use-cases/shop/managed-bot.use-case.js"
import { RegisterShopUseCase } from "../../application/use-cases/shop/register-shop.use-case.js"
import {
    ResubmitShopUseCase,
    ReviewShopUseCase,
} from "../../application/use-cases/shop/review-shop.use-case.js"
import { District } from "../../domain/entities/district.js"
import { UpdateShopUseCase } from "../../application/use-cases/shop/update-shop.use-case.js"
import { BotSource } from "../../domain/enums/bot-source.js"
import { BusinessStatus } from "../../domain/enums/business-status.js"
import { BusinessType } from "../../domain/enums/business-type.js"
import { BusinessRuleViolationError } from "../../domain/errors/business-rule.error.js"
import { ConflictError } from "../../domain/errors/conflict.error.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../domain/errors/not-found.error.js"
import { Location } from "../../domain/value-objects/location.js"
import { NOON_MONDAY_UZ, OWNER_TG, STRANGER_TG, TEST_CARD, makeBusiness } from "../fixtures.js"
import {
    InMemoryBusinesses,
    InMemoryDistricts,
    InMemoryManagedBots,
    InMemoryPayoutCards,
    fixedClock,
} from "../in-memory.js"

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
    let cards: InMemoryPayoutCards
    let managedBots: InMemoryManagedBots
    let districts: InMemoryDistricts

    beforeEach(() => {
        businesses = new InMemoryBusinesses()
        cards = new InMemoryPayoutCards()
        managedBots = new InMemoryManagedBots()
        districts = new InMemoryDistricts()
    })

    describe("RegisterShop", () => {
        it("creates a pending shop, derives the slug and keeps the token for the adapter", async () => {
            const shop = await new RegisterShopUseCase(
                businesses,
                clock,
                cards,
                managedBots,
                districts,
            ).execute(registration())
            expect(shop.status).toBe(BusinessStatus.PENDING)
            expect(shop.slug).toBe("osh-markaz")
            expect(shop.delivery).toEqual({ fee: 10_000, freeFrom: 150_000, minOrder: undefined })
            expect(shop.location).toEqual({ latitude: 41.32, longitude: 69.23 })
            expect(shop.botUsername).toBe("Osh_Markaz_bot")
            expect(businesses.tokens.get(shop.id)).toBe("555:secret")
            expect(shop).not.toHaveProperty("token")
            // The card is a required step: the shop takes transfers from the first order.
            expect(businesses.items.get(shop.id)?.acceptsCardTransfers()).toBe(true)
            // It is the shop's first card in its list, and the one customers are shown.
            const [first] = await cards.listByBusiness(shop.id)
            expect(first?.card.number).toBe("4111111111111111")
            expect(businesses.items.get(shop.id)?.paymentCardId).toBe(first?.id)
        })

        it("adds a suffix when the slug is taken", async () => {
            const useCase = new RegisterShopUseCase(
                businesses,
                clock,
                cards,
                managedBots,
                districts,
            )
            await useCase.execute(registration())
            const second = await useCase.execute(
                registration({ bot: { id: 556, username: "osh_markaz_bot", token: "x" } }),
            )
            expect(second.slug).toBe("osh-markaz-2")
        })

        it("rejects a bot that is already connected", async () => {
            const useCase = new RegisterShopUseCase(
                businesses,
                clock,
                cards,
                managedBots,
                districts,
            )
            await useCase.execute(registration())
            await expect(useCase.execute(registration())).rejects.toThrow(ConflictError)
        })

        it("a short application: no card and no fee yet, the district from the location", async () => {
            const tashkent = District.create({
                id: "d-1",
                name: "Toshkent",
                center: Location.create(41.31, 69.24),
                radiusMeters: 20_000,
                now: new Date(),
            })
            await districts.save(tashkent)
            const shop = await new RegisterShopUseCase(
                businesses,
                clock,
                cards,
                managedBots,
                districts,
            ).execute(registration({ payoutCard: undefined, deliveryFee: undefined }))
            expect(shop.delivery.fee).toBe(0)
            expect(shop.hasPayoutCard).toBe(false)
            expect(shop.inDistrict).toBe(true)
            expect(await cards.listByBusiness(shop.id)).toEqual([])
            const far = await new RegisterShopUseCase(
                businesses,
                clock,
                cards,
                managedBots,
                districts,
            ).execute(
                registration({
                    bot: { id: 600, username: "Uzoq_bot", token: "600:x" },
                    location: undefined,
                }),
            )
            expect(far.inDistrict).toBe(false)
        })

        it("a pasted token makes a `token` shop", async () => {
            const shop = await new RegisterShopUseCase(
                businesses,
                clock,
                cards,
                managedBots,
                districts,
            ).execute(registration())
            expect(shop.managedBot).toBe(false)
        })
    })

    describe("Managed bots", () => {
        const MANAGED = { id: 777, username: "Osh_Saroy_bot" }

        async function created(owner = OWNER_TG): Promise<void> {
            const change = await new ManagedBotChangedUseCase(
                businesses,
                managedBots,
                clock,
            ).execute({ bot: MANAGED, ownerTelegramId: owner, token: "777:first" })
            expect(change).toEqual({ kind: "created", botUsername: "Osh_Saroy_bot" })
        }

        it("a bot created from the Zumda bot waits for its owner's application", async () => {
            await created()
            const list = new ListMyManagedBotsUseCase(managedBots)
            expect(await list.execute(OWNER_TG)).toEqual([
                { botId: 777, username: "Osh_Saroy_bot" },
            ])
            expect(await list.execute(STRANGER_TG)).toEqual([])
        })

        it("the owner applies with it: the token never comes from the client", async () => {
            await created()
            const register = new RegisterShopUseCase(
                businesses,
                clock,
                cards,
                managedBots,
                districts,
            )
            const shop = await register.execute(registration({ bot: { managedBotId: 777 } }))
            expect(shop.managedBot).toBe(true)
            expect(shop.botUsername).toBe("Osh_Saroy_bot")
            expect(shop.slug).toBe("osh-saroy")
            expect(businesses.tokens.get(shop.id)).toBe("777:first")
            // Taken: no longer offered, and cannot make a second shop.
            expect(await new ListMyManagedBotsUseCase(managedBots).execute(OWNER_TG)).toEqual([])
            await expect(
                register.execute(registration({ bot: { managedBotId: 777 } })),
            ).rejects.toThrow(EntityNotFoundError)
        })

        it("nobody applies with a bot they did not create, or one that does not exist", async () => {
            await created()
            const register = new RegisterShopUseCase(
                businesses,
                clock,
                cards,
                managedBots,
                districts,
            )
            await expect(
                register.execute(
                    registration({ ownerTelegramId: STRANGER_TG, bot: { managedBotId: 777 } }),
                ),
            ).rejects.toThrow(EntityNotFoundError)
            await expect(
                register.execute(registration({ bot: { managedBotId: 778 } })),
            ).rejects.toThrow(EntityNotFoundError)
        })

        it("a new token of the shop's bot is kept; a new owner is reported, not handed over", async () => {
            await created()
            const shop = await new RegisterShopUseCase(
                businesses,
                clock,
                cards,
                managedBots,
                districts,
            ).execute(registration({ bot: { managedBotId: 777 } }))
            const changed = new ManagedBotChangedUseCase(businesses, managedBots, clock)

            const renewed = await changed.execute({
                bot: MANAGED,
                ownerTelegramId: OWNER_TG,
                token: "777:second",
            })
            expect(renewed).toMatchObject({ kind: "tokenChanged", shop: { id: shop.id } })
            expect(businesses.tokens.get(shop.id)).toBe("777:second")

            const moved = await changed.execute({
                bot: MANAGED,
                ownerTelegramId: STRANGER_TG,
                token: "777:third",
            })
            expect(moved).toMatchObject({
                kind: "ownerChanged",
                shop: { id: shop.id, ownerTelegramId: OWNER_TG },
                newOwnerTelegramId: STRANGER_TG,
            })
            // The shop stays with its owner and keeps working with the current token.
            expect(businesses.items.get(shop.id)?.isOwnedBy(OWNER_TG)).toBe(true)
            expect(businesses.tokens.get(shop.id)).toBe("777:third")
            expect((await managedBots.find(777))?.businessId).toBe(shop.id)
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
            // A live shop turned off is not a rejected application.
            expect(rejected.rejection).toBeUndefined()
        })

        it("a rejected application carries the reason; the owner fixes it and applies again", async () => {
            const business = makeBusiness({ active: false })
            await businesses.save(business)
            const review = new ReviewShopUseCase(businesses, [ADMIN_TG], clock)
            const rejected = await review.execute({
                actorTelegramId: ADMIN_TG,
                businessId: business.id,
                decision: "reject",
                reason: "  Manzil yo'q  ",
            })
            expect(rejected.status).toBe(BusinessStatus.DISABLED)
            expect(rejected.rejection).toEqual({ at: expect.any(String), reason: "Manzil yo'q" })

            const resubmit = new ResubmitShopUseCase(businesses, clock)
            await expect(
                resubmit.execute({ ownerTelegramId: STRANGER_TG, businessId: business.id }),
            ).rejects.toThrow(ForbiddenError)
            const again = await resubmit.execute({
                ownerTelegramId: OWNER_TG,
                businessId: business.id,
            })
            expect(again.status).toBe(BusinessStatus.PENDING)
            expect(again.rejection).toBeUndefined()
            // Only a rejected application goes back: a pending or live one cannot.
            await expect(
                resubmit.execute({ ownerTelegramId: OWNER_TG, businessId: business.id }),
            ).rejects.toThrow(BusinessRuleViolationError)

            const approved = await review.execute({
                actorTelegramId: ADMIN_TG,
                businessId: business.id,
                decision: "approve",
            })
            expect(approved.rejection).toBeUndefined()
        })
    })

    describe("GetShopBySlug and ListMyShops", () => {
        it("a shop waiting for approval opens soon; a turned-off one only to its owner", async () => {
            const waiting = makeBusiness({ active: false })
            await businesses.save(waiting)
            const getShop = new GetShopBySlugUseCase(businesses, clock)
            const soon = await getShop.execute("osh-markaz", STRANGER_TG)
            expect(soon.opensSoon).toBe(true)
            waiting.disable()
            await businesses.save(waiting)
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

import { beforeEach, describe, expect, it } from "vitest"

import {
    AssignCourierUseCase,
    CreateCourierInviteUseCase,
    DeactivateCourierUseCase,
    GetCourierHomeUseCase,
    JoinAsCourierUseCase,
    ListCouriersUseCase,
    ReviewCourierUseCase,
    SetCourierScheduleUseCase,
    SetShiftUseCase,
    UpdateCourierProfileUseCase,
} from "../../application/use-cases/courier/courier.use-cases.js"
import {
    AdvanceOrderUseCase,
    CancelOrderUseCase,
    CourierAdvanceOrderUseCase,
    GetOrderUseCase,
} from "../../application/use-cases/order/order.use-cases.js"
import { ConfirmPaymentUseCase } from "../../application/use-cases/money/money.use-cases.js"
import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import { UpdateProductUseCase } from "../../application/use-cases/product/product.use-cases.js"
import { UpdateShopUseCase } from "../../application/use-cases/shop/update-shop.use-case.js"
import { Product } from "../../domain/entities/product.js"
import { CourierStatus } from "../../domain/enums/courier-status.js"
import { Feature } from "../../domain/enums/feature.js"
import { OrderChannel } from "../../domain/enums/order-channel.js"
import { OrderStatus } from "../../domain/enums/order-status.js"
import { Unit } from "../../domain/enums/unit.js"
import { BusinessRuleViolationError } from "../../domain/errors/business-rule.error.js"
import { ConflictError } from "../../domain/errors/conflict.error.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../domain/errors/not-found.error.js"
import { ValidationError } from "../../domain/errors/validation.error.js"
import { Money } from "../../domain/value-objects/money.js"
import {
    CUSTOMER_TG,
    NOON_MONDAY_UZ,
    OWNER_TG,
    STRANGER_TG,
    makeBusiness,
    makeCustomer,
    makeProduct,
} from "../fixtures.js"
import {
    InMemoryBusinesses,
    InMemoryCouriers,
    InMemoryDistricts,
    InMemoryCustomers,
    InMemoryOrders,
    InMemoryProducts,
    fixedClock,
} from "../in-memory.js"

const COURIER_TG = 5005
const clock = fixedClock(NOON_MONDAY_UZ)
const courierUser = { id: COURIER_TG, firstName: "Jasur" }
const customerUser = { id: CUSTOMER_TG, firstName: "Aziz" }

describe("shop couriers and vertical features", () => {
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts
    let customers: InMemoryCustomers
    let orders: InMemoryOrders
    let couriers: InMemoryCouriers

    function courierDeps(): {
        businesses: InMemoryBusinesses
        couriers: InMemoryCouriers
        orders: InMemoryOrders
        clock: typeof clock
    } {
        return { businesses, couriers, orders, clock }
    }

    function orderDeps(): {
        businesses: InMemoryBusinesses
        customers: InMemoryCustomers
        couriers: InMemoryCouriers
        orders: InMemoryOrders
    } {
        return { businesses, customers, couriers, orders }
    }

    const place = (overrides: Partial<Parameters<PlaceOrderUseCase["execute"]>[0]> = {}) =>
        new PlaceOrderUseCase({ businesses, products, customers, orders, clock }).execute({
            user: customerUser,
            businessId: "biz-1",
            items: [{ productId: "prod-1", quantity: 2 }],
            address: "Navoiy 12",
            ...overrides,
        })

    /** Invite → the person accepts in the courier bot → still waiting for the owner. */
    async function inviteCourier(businessId = "biz-1"): Promise<string> {
        const invite = await new CreateCourierInviteUseCase(courierDeps()).execute({
            actorTelegramId: OWNER_TG,
            businessId,
        })
        const joined = await new JoinAsCourierUseCase(courierDeps()).execute({
            code: invite.code,
            user: courierUser,
        })
        return joined.courier.id
    }

    /** Invited, approved by the owner, on shift today: ready for orders. */
    async function hireCourier(businessId = "biz-1"): Promise<string> {
        const id = await inviteCourier(businessId)
        await new ReviewCourierUseCase(courierDeps()).execute({
            actorTelegramId: OWNER_TG,
            businessId,
            courierId: id,
            approve: true,
        })
        await new SetShiftUseCase(courierDeps()).execute({ telegramId: COURIER_TG, onShift: true })
        return id
    }

    /** "Today" for the courier screen is real time: entities stamp updates with it. */
    function homeDeps(): ReturnType<typeof courierDeps> & { districts: InMemoryDistricts } {
        return {
            ...courierDeps(),
            clock: fixedClock(new Date()),
            districts: new InMemoryDistricts(),
        }
    }

    /** «Деньги пришли — принять»: the transfer arrived, the shop starts. */
    async function payAndAccept(orderId: string, businessId = "biz-1"): Promise<void> {
        await new ConfirmPaymentUseCase({ businesses, orders, clock }).execute({
            actorTelegramId: OWNER_TG,
            businessId,
            orderId,
        })
    }

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        products = new InMemoryProducts()
        customers = new InMemoryCustomers()
        orders = new InMemoryOrders()
        couriers = new InMemoryCouriers()
        await businesses.save(makeBusiness())
        await businesses.save(makeBusiness({ id: "biz-2" }))
        await products.save(makeProduct())
        await customers.save(makeCustomer())
        // The customer sent their phone to this shop's bot.
        await customers.sharePhoneWith("cust-1", "biz-1", NOON_MONDAY_UZ)
    })

    describe("couriers", () => {
        it("the owner invites; the person accepts once; the owner approves", async () => {
            const create = new CreateCourierInviteUseCase(courierDeps())
            await expect(
                create.execute({ actorTelegramId: STRANGER_TG, businessId: "biz-1" }),
            ).rejects.toThrow(ForbiddenError)
            const invite = await create.execute({ actorTelegramId: OWNER_TG, businessId: "biz-1" })
            expect(invite.code).toMatch(/^[A-Za-z0-9_-]{16}$/)

            const join = new JoinAsCourierUseCase(courierDeps())
            await expect(join.execute({ code: "unknown-code", user: courierUser })).rejects.toThrow(
                EntityNotFoundError,
            )
            const joined = await join.execute({ code: invite.code, user: courierUser })
            // The shop comes from the invite; the courier bot asks for the phone once.
            expect(joined.business.id).toBe("biz-1")
            expect(joined.needsPhone).toBe(true)
            expect(joined.courier).toMatchObject({ name: "Jasur", status: "pending" })
            await expect(join.execute({ code: invite.code, user: courierUser })).rejects.toThrow(
                BusinessRuleViolationError,
            )

            const review = new ReviewCourierUseCase(courierDeps())
            const ids = { businessId: "biz-1", courierId: joined.courier.id, approve: true }
            await expect(review.execute({ ...ids, actorTelegramId: STRANGER_TG })).rejects.toThrow(
                ForbiddenError,
            )
            const approved = await review.execute({ ...ids, actorTelegramId: OWNER_TG })
            expect(approved).toMatchObject({
                telegramId: COURIER_TG,
                courier: { status: "active", unavailableReason: "not_on_shift" },
            })
            await expect(review.execute({ ...ids, actorTelegramId: OWNER_TG })).rejects.toThrow(
                ConflictError,
            )
        })

        it("waiting couriers come first; declined and removed ones leave the list", async () => {
            const waiting = await inviteCourier()
            const list = new ListCouriersUseCase(courierDeps())
            const owner = { actorTelegramId: OWNER_TG, businessId: "biz-1" }
            expect((await list.execute(owner)).map((c) => c.status)).toEqual([
                CourierStatus.PENDING,
            ])
            await new ReviewCourierUseCase(courierDeps()).execute({
                ...owner,
                courierId: waiting,
                approve: false,
            })
            expect(await list.execute(owner)).toHaveLength(0)

            // A new invite brings the same person back, waiting again.
            expect(await inviteCourier()).toBe(waiting)
            const id = await hireCourier()
            expect(id).toBe(waiting)
            const removed = await new DeactivateCourierUseCase(courierDeps()).execute({
                ...owner,
                courierId: id,
            })
            expect(removed.telegramId).toBe(COURIER_TG)
            expect(await list.execute(owner)).toHaveLength(0)
            await expect(
                new DeactivateCourierUseCase(courierDeps()).execute({
                    actorTelegramId: OWNER_TG,
                    businessId: "biz-2",
                    courierId: id,
                }),
            ).rejects.toThrow(EntityNotFoundError)
        })

        it("assign only an approved courier on shift; then picked up, delivered, on the screen", async () => {
            const courierId = await inviteCourier()
            const order = await place()
            const advance = new AdvanceOrderUseCase(orderDeps())
            const owner = { actorTelegramId: OWNER_TG, businessId: "biz-1", orderId: order.id }
            await payAndAccept(order.id)
            const assign = new AssignCourierUseCase(courierDeps())
            // Not approved yet.
            await expect(assign.execute({ ...owner, courierId })).rejects.toThrow(
                /cannot take an order/,
            )
            await new ReviewCourierUseCase(courierDeps()).execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                courierId,
                approve: true,
            })
            // Approved, but not on shift.
            await expect(assign.execute({ ...owner, courierId })).rejects.toThrow(
                BusinessRuleViolationError,
            )
            await new SetShiftUseCase(courierDeps()).execute({
                telegramId: COURIER_TG,
                onShift: true,
            })
            const assigned = await assign.execute({ ...owner, courierId })
            expect(assigned.courierName).toBe("Jasur")

            const asCourier = new CourierAdvanceOrderUseCase(orderDeps())
            const me = { telegramId: COURIER_TG, orderId: order.id }
            await expect(asCourier.execute({ ...me, to: OrderStatus.PREPARING })).rejects.toThrow(
                ForbiddenError,
            )
            await advance.execute({ ...owner, to: OrderStatus.PREPARING })
            await advance.execute({ ...owner, to: OrderStatus.READY })
            await asCourier.execute({ ...me, to: OrderStatus.PICKED_UP })
            const done = await asCourier.execute({ ...me, to: OrderStatus.DELIVERED })
            expect(done.status).toBe(OrderStatus.DELIVERED)
            await expect(
                asCourier.execute({ ...me, orderId: "missing", to: OrderStatus.PICKED_UP }),
            ).rejects.toThrow(EntityNotFoundError)

            const home = await new GetCourierHomeUseCase(homeDeps()).execute({
                telegramId: COURIER_TG,
            })
            expect(home.orders.map((o) => [o.id, o.shopName])).toEqual([[order.id, "Osh Markaz"]])
            expect(home.shops).toMatchObject([{ businessId: "biz-1", worksToday: true }])
            expect(home.profile.name).toBe("Jasur")
        })

        it("one person, two shops: each shop sets its own days; the screen shows both", async () => {
            const food = await hireCourier("biz-1")
            const water = await hireCourier("biz-2")
            expect(food).not.toBe(water)
            const schedule = new SetCourierScheduleUseCase(courierDeps())
            const off = await schedule.execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-2",
                courierId: water,
                offToday: true,
            })
            expect(off).toMatchObject({ offToday: true, unavailableReason: "off_today" })
            await expect(
                schedule.execute({
                    actorTelegramId: OWNER_TG,
                    businessId: "biz-2",
                    courierId: water,
                    workDays: [],
                }),
            ).rejects.toThrow(ValidationError)
            const days = await schedule.execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                courierId: food,
                workDays: ["sat", "mon"],
            })
            expect(days.workDays).toEqual(["mon", "sat"])

            const home = await new GetCourierHomeUseCase({
                ...homeDeps(),
                clock,
            }).execute({ telegramId: COURIER_TG })
            // Monday noon: the food shop today; the water shop switched them off.
            expect(home.shops.map((shop) => [shop.businessId, shop.worksToday])).toEqual([
                ["biz-1", true],
                ["biz-2", false],
            ])

            // The owner of the water shop sees only their own courier, never the food shop.
            const list = await new ListCouriersUseCase(courierDeps()).execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-2",
            })
            expect(list.map((c) => c.id)).toEqual([water])
        })

        it("only couriers have a courier screen; the vehicle is theirs to set", async () => {
            const stranger = { telegramId: STRANGER_TG }
            await expect(new GetCourierHomeUseCase(homeDeps()).execute(stranger)).rejects.toThrow(
                ForbiddenError,
            )
            await expect(
                new SetShiftUseCase(courierDeps()).execute({ ...stranger, onShift: true }),
            ).rejects.toThrow(ForbiddenError)
            // Waiting for approval is not enough either.
            await inviteCourier()
            await expect(
                new SetShiftUseCase(courierDeps()).execute({
                    telegramId: COURIER_TG,
                    onShift: true,
                }),
            ).rejects.toThrow(ForbiddenError)

            await hireCourier()
            const profile = await new UpdateCourierProfileUseCase(courierDeps()).execute({
                telegramId: COURIER_TG,
                vehicle: "Damas",
            })
            expect(profile).toMatchObject({ vehicle: "Damas", onShift: true })
            const ended = await new SetShiftUseCase(courierDeps()).execute({
                telegramId: COURIER_TG,
                onShift: false,
            })
            expect(ended.onShift).toBe(false)
        })

        it("the courier sees but never cancels; strangers get nothing", async () => {
            const courierId = await hireCourier()
            const order = await place()
            await payAndAccept(order.id)
            await new AssignCourierUseCase(courierDeps()).execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                orderId: order.id,
                courierId,
            })
            const asCourier = { telegramId: COURIER_TG, businessId: "biz-1", orderId: order.id }
            expect((await new GetOrderUseCase(orderDeps()).execute(asCourier)).id).toBe(order.id)
            await expect(new CancelOrderUseCase(orderDeps()).execute(asCourier)).rejects.toThrow(
                ForbiddenError,
            )
            await expect(
                new CourierAdvanceOrderUseCase(orderDeps()).execute({
                    telegramId: STRANGER_TG,
                    orderId: order.id,
                    to: OrderStatus.PICKED_UP,
                }),
            ).rejects.toThrow(ForbiddenError)
            await expect(
                new AdvanceOrderUseCase(orderDeps()).execute({
                    actorTelegramId: CUSTOMER_TG,
                    businessId: "biz-1",
                    orderId: order.id,
                    to: OrderStatus.PREPARING,
                }),
            ).rejects.toThrow(ForbiddenError)
        })

        it("assigning checks the shop of the order and of the courier", async () => {
            const courierId = await hireCourier("biz-2")
            const order = await place()
            const assign = new AssignCourierUseCase(courierDeps())
            await expect(
                assign.execute({
                    actorTelegramId: OWNER_TG,
                    businessId: "biz-1",
                    orderId: order.id,
                    courierId,
                }),
            ).rejects.toThrow(EntityNotFoundError)
            await expect(
                assign.execute({
                    actorTelegramId: OWNER_TG,
                    businessId: "biz-2",
                    orderId: order.id,
                    courierId,
                }),
            ).rejects.toThrow(EntityNotFoundError)
        })
    })

    describe("placing orders", () => {
        it("own-bot orders never carry a commission", async () => {
            const business = await businesses.findById("biz-1")
            business?.joinMarketplace(1_000, NOON_MONDAY_UZ)
            const order = await place()
            expect(order).toMatchObject({ channel: OrderChannel.SHOP_BOT, commission: 0 })
            const market = await place({ channel: OrderChannel.MARKETPLACE })
            expect(market).toMatchObject({ commissionBps: 1_000, commission: 7_000 })
        })

        it("marketplace orders need a signed deal", async () => {
            await expect(place({ channel: OrderChannel.MARKETPLACE })).rejects.toThrow(
                BusinessRuleViolationError,
            )
        })

        it("sells weight items in steps and prices them per kilogram", async () => {
            await products.save(
                Product.create({
                    id: "tomato",
                    businessId: "biz-1",
                    name: "Pomidor",
                    price: 12_000,
                    unit: Unit.KG,
                    category: "produce",
                }),
            )
            const order = await place({ items: [{ productId: "tomato", quantity: 1500 }] })
            expect(order.subtotal).toBe(18_000)
            expect(order.items[0]).toMatchObject({ quantity: 1500, category: "produce" })
            await expect(
                place({ items: [{ productId: "tomato", quantity: 700 }] }),
            ).rejects.toThrow(ValidationError)
        })

        it("adds a deposit for kept bottles when the shop uses bottle returns", async () => {
            await products.save(
                Product.create({
                    id: "bottle",
                    businessId: "biz-1",
                    name: "Suv 19 l",
                    price: 15_000,
                    unit: Unit.BOTTLE_19L,
                    category: "water",
                    returnable: true,
                }),
            )
            const shop = await businesses.findById("biz-1")
            shop?.setBottleDeposit(Money.of(30_000))
            const items = [{ productId: "bottle", quantity: 3 }]

            const withoutFeature = await place({ items, bottlesReturned: 1 })
            expect(withoutFeature).toMatchObject({ depositTotal: 0, bottlesReturned: 0 })

            shop?.setFeatures([Feature.BOTTLE_DEPOSIT])
            const water = await place({ items, bottlesReturned: 1 })
            expect(water).toMatchObject({ bottlesReturned: 1, depositTotal: 60_000 })
            expect(water.total).toBe(45_000 + 10_000 + 60_000)
        })

        it("respects today's stop-list", async () => {
            await new UpdateProductUseCase(businesses, products, clock).execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                productId: "prod-1",
                patch: { stopForToday: true },
            })
            await expect(place()).rejects.toThrow(BusinessRuleViolationError)
        })
    })

    it("the owner switches features and sets the bottle deposit", async () => {
        const shop = await new UpdateShopUseCase(businesses, clock).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            patch: { features: [Feature.BOTTLE_DEPOSIT], bottleDeposit: 25_000 },
        })
        expect(shop.features).toEqual([Feature.BOTTLE_DEPOSIT])
        expect(shop.bottleDeposit).toBe(25_000)
        await expect(
            new UpdateShopUseCase(businesses, clock).execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                patch: { features: ["flying"] },
            }),
        ).rejects.toThrow(ValidationError)
    })
})

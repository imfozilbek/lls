import { beforeEach, describe, expect, it } from "vitest"

import {
    AssignCourierUseCase,
    CreateCourierInviteUseCase,
    DeactivateCourierUseCase,
    JoinAsCourierUseCase,
    ListCourierOrdersUseCase,
    ListCouriersUseCase,
} from "../../application/use-cases/courier/courier.use-cases.js"
import {
    AdvanceOrderUseCase,
    CancelOrderUseCase,
    GetOrderUseCase,
} from "../../application/use-cases/order/order.use-cases.js"
import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import { UpdateProductUseCase } from "../../application/use-cases/product/product.use-cases.js"
import { UpdateShopUseCase } from "../../application/use-cases/shop/update-shop.use-case.js"
import { Product } from "../../domain/entities/product.js"
import { Feature } from "../../domain/enums/feature.js"
import { OrderChannel } from "../../domain/enums/order-channel.js"
import { OrderStatus } from "../../domain/enums/order-status.js"
import { PaidWith } from "../../domain/enums/payment.js"
import { Unit } from "../../domain/enums/unit.js"
import { BusinessRuleViolationError } from "../../domain/errors/business-rule.error.js"
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

    async function hireCourier(businessId = "biz-1"): Promise<string> {
        const invite = await new CreateCourierInviteUseCase(courierDeps()).execute({
            actorTelegramId: OWNER_TG,
            businessId,
        })
        const courier = await new JoinAsCourierUseCase(courierDeps()).execute({
            code: invite.code,
            businessId,
            user: courierUser,
        })
        return courier.id
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
        it("the owner invites; the link works once and only in its own shop", async () => {
            const create = new CreateCourierInviteUseCase(courierDeps())
            await expect(
                create.execute({ actorTelegramId: STRANGER_TG, businessId: "biz-1" }),
            ).rejects.toThrow(ForbiddenError)
            const invite = await create.execute({ actorTelegramId: OWNER_TG, businessId: "biz-1" })
            expect(invite.code).toMatch(/^[A-Za-z0-9_-]{16}$/)

            const join = new JoinAsCourierUseCase(courierDeps())
            await expect(
                join.execute({ code: invite.code, businessId: "biz-2", user: courierUser }),
            ).rejects.toThrow(EntityNotFoundError)
            const courier = await join.execute({
                code: invite.code,
                businessId: "biz-1",
                user: courierUser,
            })
            expect(courier).toMatchObject({ name: "Jasur", isActive: true })
            await expect(
                join.execute({ code: invite.code, businessId: "biz-1", user: courierUser }),
            ).rejects.toThrow(BusinessRuleViolationError)
        })

        it("lists, deactivates and lets a courier come back with a new link", async () => {
            const id = await hireCourier()
            const list = new ListCouriersUseCase(courierDeps())
            expect(
                await list.execute({ actorTelegramId: OWNER_TG, businessId: "biz-1" }),
            ).toHaveLength(1)
            await new DeactivateCourierUseCase(courierDeps()).execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                courierId: id,
            })
            expect(
                await list.execute({ actorTelegramId: OWNER_TG, businessId: "biz-1" }),
            ).toHaveLength(0)
            await expect(
                new DeactivateCourierUseCase(courierDeps()).execute({
                    actorTelegramId: OWNER_TG,
                    businessId: "biz-2",
                    courierId: id,
                }),
            ).rejects.toThrow(EntityNotFoundError)
            expect(await hireCourier()).toBe(id)
        })

        it("assign → courier picks up and delivers → sees it in today's list", async () => {
            const courierId = await hireCourier()
            const order = await place()
            const advance = new AdvanceOrderUseCase(orderDeps())
            const owner = { actorTelegramId: OWNER_TG, businessId: "biz-1", orderId: order.id }
            const courier = { actorTelegramId: COURIER_TG, businessId: "biz-1", orderId: order.id }

            await advance.execute({ ...owner, to: OrderStatus.ACCEPTED })
            const assigned = await new AssignCourierUseCase(courierDeps()).execute({
                ...owner,
                courierId,
            })
            expect(assigned.courierName).toBe("Jasur")

            await expect(
                advance.execute({ ...courier, to: OrderStatus.PREPARING }),
            ).rejects.toThrow(ForbiddenError)
            await advance.execute({ ...owner, to: OrderStatus.PREPARING })
            await advance.execute({ ...owner, to: OrderStatus.READY })
            await advance.execute({ ...courier, to: OrderStatus.PICKED_UP })
            const done = await advance.execute({
                ...courier,
                to: OrderStatus.DELIVERED,
                paidWith: PaidWith.CASH,
            })
            expect(done.status).toBe(OrderStatus.DELIVERED)

            // Entities stamp updates with the real time, so "today" must be real time too.
            const today = { ...courierDeps(), clock: fixedClock(new Date()) }
            const mine = await new ListCourierOrdersUseCase(today).execute({
                telegramId: COURIER_TG,
                businessId: "biz-1",
            })
            expect(mine.map((o) => o.id)).toEqual([order.id])
        })

        it("the courier sees but never cancels; strangers get nothing", async () => {
            const courierId = await hireCourier()
            const order = await place()
            await new AdvanceOrderUseCase(orderDeps()).execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                orderId: order.id,
                to: OrderStatus.ACCEPTED,
            })
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
                new ListCourierOrdersUseCase(courierDeps()).execute({
                    telegramId: STRANGER_TG,
                    businessId: "biz-1",
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

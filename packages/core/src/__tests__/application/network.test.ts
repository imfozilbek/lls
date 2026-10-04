import { beforeEach, describe, expect, it } from "vitest"

import { GetCourierHomeUseCase } from "../../application/use-cases/courier/courier.use-cases.js"
import {
    AutoRequestNetworkUseCase,
    ClaimNetworkOrderUseCase,
    FreeNetworkCouriersUseCase,
    ListNetworkOrdersUseCase,
    NetworkStatsUseCase,
    OfferNetworkUseCase,
    OverdueNetworkOrdersUseCase,
    RequestNetworkCourierUseCase,
    SetDistrictUseCase,
    SetNetworkMembershipUseCase,
    districtIdFor,
} from "../../application/use-cases/network/network.use-cases.js"
import { CourierAdvanceOrderUseCase } from "../../application/use-cases/order/order.use-cases.js"
import { UpdateShopUseCase } from "../../application/use-cases/shop/update-shop.use-case.js"
import { Order } from "../../domain/entities/order.js"
import { OrderItem } from "../../domain/entities/order-item.js"
import { OrderChannel } from "../../domain/enums/order-channel.js"
import { OrderStatus } from "../../domain/enums/order-status.js"
import { Unit } from "../../domain/enums/unit.js"
import { BusinessRuleViolationError } from "../../domain/errors/business-rule.error.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../domain/errors/not-found.error.js"
import { ValidationError } from "../../domain/errors/validation.error.js"
import { Location } from "../../domain/value-objects/location.js"
import { Money } from "../../domain/value-objects/money.js"
import { OWNER_TG, makeBusiness, makeCourier } from "../fixtures.js"
import {
    InMemoryBusinesses,
    InMemoryCouriers,
    InMemoryCustomers,
    InMemoryDistricts,
    InMemoryTrips,
    InMemoryOrders,
    fixedClock,
} from "../in-memory.js"

import type { NetworkDeps } from "../../application/use-cases/network/network.use-cases.js"
import type { Clock } from "../../application/ports/clock.js"

const GULISTAN = { latitude: 40.4897, longitude: 68.7842 }
const YANGIYER = { latitude: 40.275, longitude: 68.8225 }
const TASHKENT = { latitude: 41.2995, longitude: 69.2401 }
/** Bobur delivers for the water shop and agreed to the district network. */
const BOBUR_TG = 7007
const DILSHOD_TG = 7008
const JASUR_TG = 5005
const ADMIN_TG = 9999

describe("district network", () => {
    let businesses: InMemoryBusinesses
    let orders: InMemoryOrders
    let couriers: InMemoryCouriers
    let districts: InMemoryDistricts
    let now: Date
    const clock: Clock = { now: () => now }

    const deps = (): NetworkDeps => ({ businesses, couriers, orders, districts, clock })

    async function place(id: string, businessId = "biz-1"): Promise<Order> {
        const order = Order.place({
            id,
            businessId,
            customerId: "cust-1",
            number: orders.items.size + 1,
            channel: OrderChannel.SHOP_BOT,
            commissionBps: 0,
            items: [
                OrderItem.create({
                    productId: "prod-1",
                    name: "Osh",
                    unit: Unit.PORTION,
                    category: "meals",
                    unitPrice: Money.of(35_000),
                    quantity: 2,
                }),
            ],
            deliveryFee: Money.of(10_000),
            address: "Navoiy 12",
            location: Location.create(40.5, 68.79),
            customerName: "Aziz",
        })
        order.confirmPaymentAndAccept()
        await orders.save(order)
        return order
    }

    /** An approved courier of `businessId`, on shift; in the network if asked. */
    async function hire(
        telegramId: number,
        businessId: string,
        options: { inNetwork?: boolean; id?: string } = {},
    ): Promise<void> {
        const courier = makeCourier({
            id: options.id ?? `${businessId}-${telegramId}`,
            businessId,
            telegramId,
            now,
        })
        const existing = await couriers.findProfile(telegramId)
        const profile = existing ?? courier.profile
        if (options.inNetwork) {
            profile.setInNetwork(true, now)
        }
        await couriers.saveProfile(profile)
        await couriers.save(
            existing
                ? makeCourier({
                      id: options.id ?? `${businessId}-${telegramId}`,
                      businessId,
                      telegramId,
                      now,
                  })
                : courier,
        )
    }

    beforeEach(async () => {
        now = new Date()
        businesses = new InMemoryBusinesses()
        orders = new InMemoryOrders(businesses)
        couriers = new InMemoryCouriers(businesses, orders)
        districts = new InMemoryDistricts()
        const food = makeBusiness()
        food.updateProfile({ location: Location.create(GULISTAN.latitude, GULISTAN.longitude) })
        const water = makeBusiness({ id: "biz-2" })
        water.updateProfile({ location: Location.create(YANGIYER.latitude, YANGIYER.longitude) })
        const far = makeBusiness({ id: "biz-3" })
        far.updateProfile({ location: Location.create(TASHKENT.latitude, TASHKENT.longitude) })
        await Promise.all([food, water, far].map((shop) => businesses.save(shop)))
        const set = await new SetDistrictUseCase(deps(), [ADMIN_TG]).execute({
            actorTelegramId: ADMIN_TG,
            name: "Guliston",
            center: GULISTAN,
            radiusKm: 30,
        })
        expect(set.shops).toBe(2)
        await hire(BOBUR_TG, "biz-2", { inNetwork: true })
    })

    describe("districts", () => {
        it("the admin's district puts shops in it; moving it or a shop recomputes", async () => {
            const set = new SetDistrictUseCase(deps(), [ADMIN_TG])
            const admin = { actorTelegramId: ADMIN_TG }
            await expect(
                set.execute({ actorTelegramId: OWNER_TG, name: "X", waitMinutes: 5 }),
            ).rejects.toThrow(ForbiddenError)
            const guliston = await districts.findByName("guliston")
            expect((await businesses.findById("biz-1"))?.districtId).toBe(guliston?.id)
            expect((await businesses.findById("biz-3"))?.districtId).toBeUndefined()

            const moved = await set.execute({
                ...admin,
                name: "Guliston",
                center: GULISTAN,
                radiusKm: 5,
            })
            expect(moved.shops).toBe(1)
            expect((await businesses.findById("biz-2"))?.districtId).toBeUndefined()
            const waiting = await set.execute({ ...admin, name: "Guliston", waitMinutes: 15 })
            expect(waiting.district.waitMinutes).toBe(15)
            await expect(
                set.execute({ ...admin, name: "Nowhere", waitMinutes: 5 }),
            ).rejects.toThrow(ValidationError)

            // The far shop moves into the district from its settings.
            const update = new UpdateShopUseCase(businesses, clock, districts)
            const shop = await update.execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-3",
                patch: { location: GULISTAN, networkDelivery: false },
            })
            expect(shop).toMatchObject({ inDistrict: true, networkDelivery: false })
            expect(await districtIdFor(districts, undefined)).toBeUndefined()
        })
    })

    describe("asking the network", () => {
        it("after «Принять»: goes to the network when no own courier is free", async () => {
            const auto = new AutoRequestNetworkUseCase(deps())
            const order = await place("o-1")
            const request = await auto.execute({ orderId: order.id })
            expect(request?.district.name).toBe("Guliston")
            expect(request?.order.waitingForNetwork).toBe(true)
            expect(request?.order.networkRequestedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
            // Only once, only for accepted orders without a courier.
            expect(await auto.execute({ orderId: order.id })).toMatchObject({
                order: { id: order.id },
            })
            expect(await auto.execute({ orderId: "missing" })).toBeNull()
        })

        it("stays with the shop when its own courier is free, the switch is off, or no district", async () => {
            const auto = new AutoRequestNetworkUseCase(deps())
            await hire(JASUR_TG, "biz-1")
            expect(await auto.execute({ orderId: (await place("o-1")).id })).toBeNull()

            const water = await businesses.findById("biz-2")
            water?.setNetworkDelivery(false)
            expect(await auto.execute({ orderId: (await place("o-2", "biz-2")).id })).toBeNull()

            expect(await auto.execute({ orderId: (await place("o-3", "biz-3")).id })).toBeNull()
        })

        it("the owner hands an order over by hand; a shop outside every district cannot", async () => {
            const request = new RequestNetworkCourierUseCase(deps())
            const order = await place("o-1")
            await expect(
                request.execute({ actorTelegramId: 9, businessId: "biz-1", orderId: order.id }),
            ).rejects.toThrow(ForbiddenError)
            await expect(
                request.execute({
                    actorTelegramId: OWNER_TG,
                    businessId: "biz-2",
                    orderId: order.id,
                }),
            ).rejects.toThrow(EntityNotFoundError)
            const done = await request.execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                orderId: order.id,
            })
            expect(done.order.waitingForNetwork).toBe(true)
            const far = await place("o-2", "biz-3")
            await expect(
                request.execute({
                    actorTelegramId: OWNER_TG,
                    businessId: "biz-3",
                    orderId: far.id,
                }),
            ).rejects.toThrow(expect.objectContaining({ rule: "NO_DISTRICT" }))
        })
    })

    describe("«Беру»", () => {
        async function waiting(id = "o-1"): Promise<Order> {
            const order = await place(id)
            await new AutoRequestNetworkUseCase(deps()).execute({ orderId: order.id })
            return order
        }

        it("a network courier sees it without the customer, takes it, and delivers it", async () => {
            const order = await waiting()
            const list = await new ListNetworkOrdersUseCase(deps()).execute({
                telegramId: BOBUR_TG,
            })
            expect(list).toHaveLength(1)
            expect(list[0]).toMatchObject({
                shopName: "Osh Markaz",
                total: 80_000,
                // Two portions of one dish: the courier carries two.
                itemsCount: 2,
            })
            expect(list[0]?.distanceMeters).toBeGreaterThan(0)
            expect(list[0]?.shopLocation).toEqual(GULISTAN)
            expect(JSON.stringify(list[0])).not.toContain("Navoiy")
            expect(JSON.stringify(list[0])).not.toContain("Aziz")
            expect(
                await new FreeNetworkCouriersUseCase(deps()).execute({
                    districtId: (await businesses.findById("biz-1"))?.districtId ?? "",
                }),
            ).toEqual([BOBUR_TG])

            const claim = await new ClaimNetworkOrderUseCase(deps()).execute({
                telegramId: BOBUR_TG,
                orderId: order.id,
            })
            expect(claim.order).toMatchObject({ courierName: "Jasur", viaNetwork: true })
            expect(claim.business.id).toBe("biz-1")
            const link = await couriers.findByTelegramId("biz-1", BOBUR_TG)
            expect(link?.isNetwork).toBe(true)
            // Not the shop's courier: the owner's list stays the same.
            expect(await couriers.listByBusiness("biz-1")).toHaveLength(0)
            // Busy with a network order: no second one, and no more «Новый заказ рядом».
            expect(
                await new FreeNetworkCouriersUseCase(deps()).execute({
                    districtId: link
                        ? ((await businesses.findById("biz-1"))?.districtId ?? "")
                        : "",
                }),
            ).toEqual([])

            const advance = new CourierAdvanceOrderUseCase({
                businesses,
                customers: new InMemoryCustomers(),
                couriers,
                orders,
            })
            for (const to of [OrderStatus.PREPARING, OrderStatus.READY]) {
                const stored = await orders.findById(order.id)
                stored?.advanceTo(to)
            }
            await advance.execute({
                telegramId: BOBUR_TG,
                orderId: order.id,
                to: OrderStatus.PICKED_UP,
            })
            const delivered = await advance.execute({
                telegramId: BOBUR_TG,
                orderId: order.id,
                to: OrderStatus.DELIVERED,
            })
            // Paid to the shop's card before cooking: the courier carries no money.
            expect(delivered.status).toBe(OrderStatus.DELIVERED)
            expect(delivered.payment.cashCourierId).toBeUndefined()

            // The courier sees the shop they delivered for through the network.
            const home = await new GetCourierHomeUseCase({
                ...deps(),
                trips: new InMemoryTrips(orders),
            }).execute({ telegramId: BOBUR_TG })
            expect(home.shops.map((s) => [s.shopName, s.status])).toEqual([
                ["Osh Markaz", "active"],
                ["Osh Markaz", "network"],
            ])
            expect(home.orders.map((o) => o.id)).toEqual([order.id])
            // Where to pick it up: the shop's place, for the courier's map.
            expect(home.orders[0]?.shopLocation).toEqual(GULISTAN)
        })

        it("the first one wins; the second hears «already taken»", async () => {
            await hire(DILSHOD_TG, "biz-2", { inNetwork: true })
            const order = await waiting()
            const claim = new ClaimNetworkOrderUseCase(deps())
            await claim.execute({ telegramId: BOBUR_TG, orderId: order.id })
            await expect(
                claim.execute({ telegramId: DILSHOD_TG, orderId: order.id }),
            ).rejects.toThrow(expect.objectContaining({ rule: "NETWORK_ORDER_TAKEN" }))
            // Two presses at the same moment: the store refuses the slower one.
            const second = await waiting("o-2")
            orders.claimRaces = 1
            await expect(
                claim.execute({ telegramId: DILSHOD_TG, orderId: second.id }),
            ).rejects.toThrow(BusinessRuleViolationError)
        })

        it("not in the network, not on shift, another district, or a missing order: refused", async () => {
            const order = await waiting()
            const claim = new ClaimNetworkOrderUseCase(deps())
            await hire(DILSHOD_TG, "biz-2")
            await expect(
                claim.execute({ telegramId: DILSHOD_TG, orderId: order.id }),
            ).rejects.toThrow(expect.objectContaining({ rule: "COURIER_NOT_AVAILABLE" }))
            expect(
                await new ListNetworkOrdersUseCase(deps()).execute({ telegramId: DILSHOD_TG }),
            ).toEqual([])
            await hire(8008, "biz-3", { inNetwork: true })
            await expect(claim.execute({ telegramId: 8008, orderId: order.id })).rejects.toThrow(
                ForbiddenError,
            )
            expect(
                await new ListNetworkOrdersUseCase(deps()).execute({ telegramId: 8008 }),
            ).toEqual([])
            await expect(
                claim.execute({ telegramId: BOBUR_TG, orderId: "missing" }),
            ).rejects.toThrow(EntityNotFoundError)
            await expect(claim.execute({ telegramId: 1, orderId: order.id })).rejects.toThrow(
                ForbiddenError,
            )
            // Taken back by the shop's own courier: no longer in the list.
            await hire(JASUR_TG, "biz-1")
            const stored = await orders.findById(order.id)
            const own = await couriers.findByTelegramId("biz-1", JASUR_TG)
            if (stored && own) {
                stored.assignCourier(own, now)
            }
            expect(
                await new ListNetworkOrdersUseCase(deps()).execute({ telegramId: BOBUR_TG }),
            ).toEqual([])
        })

        it("a shop that removed the courier does not offer them its orders", async () => {
            await hire(BOBUR_TG, "biz-1", { id: "food-bobur" })
            const link = await couriers.findById("food-bobur")
            link?.deactivate(now)
            const order = await place("o-1")
            await new RequestNetworkCourierUseCase(deps()).execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                orderId: order.id,
            })
            expect(
                await new ListNetworkOrdersUseCase(deps()).execute({ telegramId: BOBUR_TG }),
            ).toEqual([])
            await expect(
                new ClaimNetworkOrderUseCase(deps()).execute({
                    telegramId: BOBUR_TG,
                    orderId: order.id,
                }),
            ).rejects.toThrow(expect.objectContaining({ rule: "COURIER_NOT_AVAILABLE" }))
        })
    })

    describe("consent, waiting too long, the admin's report", () => {
        it("the network is offered once; the courier joins and leaves", async () => {
            await hire(DILSHOD_TG, "biz-2")
            const offer = new OfferNetworkUseCase(deps())
            expect(await offer.execute({ telegramId: DILSHOD_TG })).toBe(true)
            expect(await offer.execute({ telegramId: DILSHOD_TG })).toBe(false)
            expect(await offer.execute({ telegramId: 1 })).toBe(false)
            const set = new SetNetworkMembershipUseCase(deps())
            expect(await set.execute({ telegramId: DILSHOD_TG, inNetwork: true })).toMatchObject({
                inNetwork: true,
            })
            expect(await set.execute({ telegramId: DILSHOD_TG, inNetwork: false })).toMatchObject({
                inNetwork: false,
            })
            await expect(set.execute({ telegramId: 1, inNetwork: true })).rejects.toThrow(
                ForbiddenError,
            )
        })

        it("two checks at the same moment report a late order once", async () => {
            const order = await place("o-1")
            await new AutoRequestNetworkUseCase(deps()).execute({ orderId: order.id })
            now = new Date(now.getTime() + 10 * 60_000)
            const [first, second] = await Promise.all([
                new OverdueNetworkOrdersUseCase(deps()).execute(),
                new OverdueNetworkOrdersUseCase(deps()).execute(),
            ])
            expect(first.length + second.length).toBe(1)
        })

        it("nobody took it in 10 minutes: reported once", async () => {
            const overdue = new OverdueNetworkOrdersUseCase(deps())
            const order = await place("o-1")
            await new AutoRequestNetworkUseCase(deps()).execute({ orderId: order.id })
            expect(await overdue.execute()).toEqual([])
            now = new Date(now.getTime() + 10 * 60_000)
            const late = await overdue.execute()
            expect(late.map((o) => [o.order.id, o.business.id, o.district.name])).toEqual([
                [order.id, "biz-1", "Guliston"],
            ])
            expect(await overdue.execute()).toEqual([])
            expect(
                await new OverdueNetworkOrdersUseCase({
                    ...deps(),
                    districts: new InMemoryDistricts(),
                }).execute(),
            ).toEqual([])
        })

        it("the admin sees free couriers, waiting orders and the network's share", async () => {
            const order = await place("o-1")
            await new AutoRequestNetworkUseCase(deps()).execute({ orderId: order.id })
            const stats = new NetworkStatsUseCase(deps(), [ADMIN_TG])
            await expect(stats.execute({ actorTelegramId: OWNER_TG })).rejects.toThrow(
                ForbiddenError,
            )
            const [guliston] = await stats.execute({ actorTelegramId: ADMIN_TG })
            expect(guliston).toMatchObject({
                name: "Guliston",
                shops: 2,
                radiusKm: 30,
                waitMinutes: 10,
                freeCouriers: 1,
                waiting: 1,
                delivered: 0,
                viaNetwork: 0,
            })
        })
    })

    it("an order without a location shows no distance", async () => {
        const order = Order.place({
            id: "o-card",
            businessId: "biz-1",
            customerId: "cust-1",
            number: 9,
            channel: OrderChannel.SHOP_BOT,
            commissionBps: 0,
            items: [
                OrderItem.create({
                    productId: "prod-1",
                    name: "Osh",
                    unit: Unit.PORTION,
                    category: "meals",
                    unitPrice: Money.of(35_000),
                    quantity: 1,
                }),
            ],
            deliveryFee: Money.of(0),
            address: "Navoiy 12",
            customerName: "Aziz",
        })
        order.confirmPaymentAndAccept()
        order.requestNetwork(now)
        await orders.save(order)
        const [listed] = await new ListNetworkOrdersUseCase(deps()).execute({
            telegramId: BOBUR_TG,
        })
        expect(listed).toMatchObject({ total: 35_000, distanceMeters: undefined })
        expect(fixedClock(now).now()).toEqual(now)
    })
})

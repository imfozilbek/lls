import { beforeEach, describe, expect, it } from "vitest"

import {
    AssignCourierUseCase,
    CreateCourierInviteUseCase,
    GetCourierHomeUseCase,
    JoinAsCourierUseCase,
    ReviewCourierUseCase,
    SetShiftUseCase,
} from "../../application/use-cases/courier/courier.use-cases.js"
import { ConfirmPaymentUseCase } from "../../application/use-cases/money/money.use-cases.js"
import {
    AdvanceOrderUseCase,
    CancelOrderUseCase,
} from "../../application/use-cases/order/order.use-cases.js"
import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import {
    CreateTripUseCase,
    ListShopTripsUseCase,
    PickUpTripUseCase,
    RefreshTripRouteUseCase,
    ReorderTripUseCase,
} from "../../application/use-cases/trip/trip.use-cases.js"
import { OrderStatus } from "../../domain/enums/order-status.js"
import { Location } from "../../domain/value-objects/location.js"
import {
    CUSTOMER_TG,
    OWNER_TG,
    STRANGER_TG,
    makeBusiness,
    makeCustomer,
    makeProduct,
} from "../fixtures.js"
import {
    FakeRoutes,
    InMemoryBusinesses,
    InMemoryCouriers,
    InMemoryCustomers,
    InMemoryDistricts,
    InMemoryOrders,
    InMemoryProducts,
    InMemoryReceipts,
    InMemoryTrips,
    fixedClock,
} from "../in-memory.js"

import type { OrderDTO } from "../../application/dtos/order.dto.js"

const COURIER_TG = 5005
const SHOP = { latitude: 38.9785, longitude: 66.6831 }
const north = (km: number) => ({ latitude: SHOP.latitude + km / 111.32, longitude: SHOP.longitude })

describe("trips: several orders one way, one courier, stops in order", () => {
    const clock = fixedClock(new Date())
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts
    let customers: InMemoryCustomers
    let orders: InMemoryOrders
    let couriers: InMemoryCouriers
    let trips: InMemoryTrips
    let routes: FakeRoutes
    let courierId: string
    let ids = 0

    const deps = () => ({
        businesses,
        customers,
        couriers,
        orders,
        products,
        districts: new InMemoryDistricts(),
        receipts: new InMemoryReceipts(),
        trips,
        routes,
        clock,
        newId: (): string => `trip-${++ids}`,
    })
    const owner = { actorTelegramId: OWNER_TG, businessId: "biz-1" }

    /** A paid, accepted order with the customer's pin `km` north of the shop. */
    async function accepted(km: number | null): Promise<OrderDTO> {
        const order = await new PlaceOrderUseCase(deps()).execute({
            user: { id: CUSTOMER_TG, firstName: "Aziz" },
            businessId: "biz-1",
            items: [{ productId: "prod-1", quantity: 2 }],
            address: "Navoiy 12",
            location: km === null ? undefined : north(km),
        })
        await new ConfirmPaymentUseCase(deps()).execute({ ...owner, orderId: order.id })
        return order
    }

    const advance = (id: string, to: OrderStatus, actor = OWNER_TG) =>
        new AdvanceOrderUseCase(deps()).execute({
            ...owner,
            actorTelegramId: actor,
            orderId: id,
            to,
        })

    const create = (orderIds: string[]) =>
        new CreateTripUseCase(deps()).execute({ ...owner, courierId, orderIds })

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        products = new InMemoryProducts()
        customers = new InMemoryCustomers()
        orders = new InMemoryOrders()
        couriers = new InMemoryCouriers()
        trips = new InMemoryTrips(orders)
        routes = new FakeRoutes()
        await businesses.save(makeBusiness())
        await products.save(makeProduct())
        await customers.save(makeCustomer())
        await customers.sharePhoneWith("cust-1", "biz-1", new Date())
        const invite = await new CreateCourierInviteUseCase(deps()).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
        })
        courierId = (
            await new JoinAsCourierUseCase(deps()).execute({
                code: invite.code,
                user: { id: COURIER_TG, firstName: "Jasur" },
            })
        ).courier.id
        await new ReviewCourierUseCase(deps()).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            courierId,
            approve: true,
        })
        await new SetShiftUseCase(deps()).execute({ telegramId: COURIER_TG, onShift: true })
        trips = new InMemoryTrips(orders)
        routes = new FakeRoutes()
        const shop = await businesses.findById("biz-1")
        shop?.updateProfile({ location: Location.create(SHOP.latitude, SHOP.longitude) })
        if (shop) {
            await businesses.save(shop)
        }
    })

    it("the owner gives three orders to one courier: stops, the way from the shop, one courier", async () => {
        const [far, near, middle] = [await accepted(3), await accepted(1), await accepted(2)]
        const made = await create([near.id, middle.id, far.id])
        expect(made.trip.stops).toEqual([near.id, middle.id, far.id])
        expect(made.courierTelegramId).toBe(COURIER_TG)
        expect(made.orders.map((o) => [o.tripStop, o.courierId])).toEqual([
            [1, courierId],
            [2, courierId],
            [3, courierId],
        ])
        // The road service got the shop first, then the stops in order.
        expect(routes.calls[0]?.[0]).toMatchObject(SHOP)
        expect(routes.calls[0]).toHaveLength(4)
        expect(made.trip.route?.line).toHaveLength(4)

        const listed = await new ListShopTripsUseCase(deps()).execute(owner)
        expect(listed.map((t) => t.id)).toEqual([made.trip.id])
        const home = await new GetCourierHomeUseCase(deps()).execute({ telegramId: COURIER_TG })
        expect(home.trips.map((t) => t.stops)).toEqual([[near.id, middle.id, far.id]])
    })

    it("without the road service the trip still goes (straight lines in the app)", async () => {
        routes.down = true
        const made = await create([(await accepted(1)).id, (await accepted(2)).id])
        expect(made.trip.route).toBeUndefined()
    })

    it("refuses one order, an order without a pin, a stranger's shop, an order in a trip", async () => {
        const a = await accepted(1)
        const b = await accepted(2)
        await expect(create([a.id])).rejects.toMatchObject({ rule: "TRIP_STOPS" })
        const noPin = await accepted(null)
        await expect(create([a.id, noPin.id])).rejects.toMatchObject({ rule: "NOT_FOR_TRIP" })
        await expect(
            new CreateTripUseCase(deps()).execute({
                actorTelegramId: STRANGER_TG,
                businessId: "biz-1",
                courierId,
                orderIds: [a.id, b.id],
            }),
        ).rejects.toThrow()
        await create([a.id, b.id])
        const c = await accepted(3)
        await expect(create([a.id, c.id])).rejects.toMatchObject({ rule: "NOT_FOR_TRIP" })
    })

    it("the owner reorders; the stops and the way follow", async () => {
        const [a, b, c] = [await accepted(1), await accepted(2), await accepted(3)]
        const made = await create([a.id, b.id, c.id])
        const moved = await new ReorderTripUseCase(deps()).execute({
            ...owner,
            tripId: made.trip.id,
            orderIds: [c.id, a.id, b.id],
        })
        expect(moved.trip.stops).toEqual([c.id, a.id, b.id])
        expect((await orders.findById(c.id))?.tripStop).toBe(1)
        expect(routes.calls).toHaveLength(2)
    })

    it("«Hammasini oldim» once all are ready; then each stop is delivered on its own", async () => {
        const [a, b] = [await accepted(1), await accepted(2)]
        const made = await create([a.id, b.id])
        const pickUp = () =>
            new PickUpTripUseCase(deps()).execute({ telegramId: COURIER_TG, tripId: made.trip.id })
        for (const id of [a.id, b.id]) {
            await advance(id, OrderStatus.PREPARING)
        }
        await advance(a.id, OrderStatus.READY)
        await expect(pickUp()).rejects.toMatchObject({ rule: "TRIP_NOT_READY" })
        await advance(b.id, OrderStatus.READY)
        await expect(
            new PickUpTripUseCase(deps()).execute({
                telegramId: STRANGER_TG,
                tripId: made.trip.id,
            }),
        ).rejects.toThrow()
        const picked = await pickUp()
        expect(picked.orders.map((o) => o.status)).toEqual(["picked_up", "picked_up"])

        await advance(a.id, OrderStatus.DELIVERED, COURIER_TG)
        expect(await new ListShopTripsUseCase(deps()).execute(owner)).toHaveLength(1)
        await advance(b.id, OrderStatus.DELIVERED, COURIER_TG)
        // All delivered: the trip is over.
        expect(await new ListShopTripsUseCase(deps()).execute(owner)).toHaveLength(0)
    })

    it("a cancelled order leaves the way; another courier takes an order out of the trip", async () => {
        const [a, b, c] = [await accepted(1), await accepted(2), await accepted(3)]
        const made = await create([a.id, b.id, c.id])
        await new CancelOrderUseCase(deps()).execute({
            telegramId: OWNER_TG,
            businessId: "biz-1",
            orderId: b.id,
        })
        await new RefreshTripRouteUseCase(deps()).execute({ tripId: made.trip.id })
        expect(routes.calls.at(-1)).toHaveLength(3)
        expect((await trips.findById(made.trip.id))?.stops).toEqual([a.id, c.id])

        const second = await new CreateCourierInviteUseCase(deps()).execute(owner)
        const other = (
            await new JoinAsCourierUseCase(deps()).execute({
                code: second.code,
                user: { id: 6006, firstName: "Otabek" },
            })
        ).courier.id
        await new ReviewCourierUseCase(deps()).execute({
            ...owner,
            courierId: other,
            approve: true,
        })
        await new SetShiftUseCase(deps()).execute({ telegramId: 6006, onShift: true })
        await new AssignCourierUseCase(deps()).execute({
            ...owner,
            orderId: c.id,
            courierId: other,
        })
        expect((await orders.findById(c.id))?.tripId).toBeUndefined()
        await new RefreshTripRouteUseCase(deps()).execute({ tripId: "nope" })
    })
})

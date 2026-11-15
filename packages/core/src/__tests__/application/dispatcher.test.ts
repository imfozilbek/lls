import { beforeEach, describe, expect, it } from "vitest"

import {
    AssignCourierUseCase,
    AutoAssignOnlyCourierUseCase,
    CreateCourierInviteUseCase,
    DeliverMyselfUseCase,
    JoinAsCourierUseCase,
    ListCouriersUseCase,
    ReviewCourierUseCase,
    SetCourierScheduleUseCase,
    SetShiftUseCase,
} from "../../application/use-cases/courier/courier.use-cases.js"
import { ConfirmPaymentUseCase } from "../../application/use-cases/money/money.use-cases.js"
import { AutoRequestNetworkUseCase } from "../../application/use-cases/network/network.use-cases.js"
import {
    AddDeliveryNoteUseCase,
    AdvanceOrderUseCase,
    CourierAdvanceOrderUseCase,
    SendOrderUseCase,
} from "../../application/use-cases/order/order.use-cases.js"
import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import { UpdateShopUseCase } from "../../application/use-cases/shop/update-shop.use-case.js"
import { OrderStatus } from "../../domain/enums/order-status.js"
import { SendWay } from "../../domain/enums/send-way.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../domain/errors/not-found.error.js"
import {
    CUSTOMER_TG,
    NOON_MONDAY_UZ,
    OWNER_TG,
    PIN,
    STRANGER_TG,
    courierSharesPhone,
    makeBusiness,
    makeCustomer,
    makeProduct,
} from "../fixtures.js"
import {
    InMemoryBusinesses,
    InMemoryCouriers,
    InMemoryCustomers,
    InMemoryDistricts,
    InMemoryOrders,
    InMemoryProducts,
    fixedClock,
} from "../in-memory.js"

import type { OrderDTO } from "../../application/dtos/order.dto.js"

const DISPATCHER_TG = 5005
const clock = fixedClock(NOON_MONDAY_UZ)

describe("a dispatcher sends the shop's orders on and keeps the customer told", () => {
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts
    let customers: InMemoryCustomers
    let orders: InMemoryOrders
    let couriers: InMemoryCouriers

    const deps = () => ({
        businesses,
        products,
        customers,
        couriers,
        orders,
        districts: new InMemoryDistricts(),
        clock,
    })
    const ids = (order: OrderDTO, actorTelegramId = OWNER_TG) => ({
        actorTelegramId,
        businessId: "biz-1",
        orderId: order.id,
    })
    const advance = (order: OrderDTO, to: OrderStatus): Promise<OrderDTO> =>
        new AdvanceOrderUseCase(deps()).execute({ ...ids(order), to })
    const courierStep = (order: OrderDTO, to: OrderStatus): Promise<OrderDTO> =>
        new CourierAdvanceOrderUseCase(deps()).execute({
            telegramId: DISPATCHER_TG,
            orderId: order.id,
            to,
        })

    /** Invited, approved, on shift: one courier of the shop. */
    async function hire(): Promise<string> {
        const invite = await new CreateCourierInviteUseCase(deps()).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
        })
        const joined = await new JoinAsCourierUseCase(deps()).execute({
            code: invite.code,
            user: { id: DISPATCHER_TG, firstName: "Dilshod" },
        })
        await courierSharesPhone(couriers, DISPATCHER_TG)
        await new ReviewCourierUseCase(deps()).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            courierId: joined.courier.id,
            approve: true,
        })
        await new SetShiftUseCase(deps()).execute({ telegramId: DISPATCHER_TG, onShift: true })
        return joined.courier.id
    }

    async function makeDispatcher(courierId: string): Promise<void> {
        await new SetCourierScheduleUseCase(deps()).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            courierId,
            dispatcher: true,
        })
    }

    /** Placed and paid: «Pul keldi» accepted and started it. */
    async function paidOrder(): Promise<OrderDTO> {
        const order = await new PlaceOrderUseCase(deps()).execute({
            user: { id: CUSTOMER_TG, firstName: "Aziz" },
            businessId: "biz-1",
            items: [{ productId: "prod-1", quantity: 1 }],
            address: "Qarshi, Navoiy 12",
            location: PIN,
        })
        return new ConfirmPaymentUseCase(deps()).execute(ids(order))
    }

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        products = new InMemoryProducts()
        customers = new InMemoryCustomers()
        orders = new InMemoryOrders()
        couriers = new InMemoryCouriers()
        await businesses.save(makeBusiness())
        await products.save(makeProduct())
        await customers.save(makeCustomer())
        await customers.sharePhoneWith("cust-1", "biz-1", NOON_MONDAY_UZ)
    })

    it("only the owner switches a courier to a dispatcher; the list shows it", async () => {
        const courierId = await hire()
        await expect(
            new SetCourierScheduleUseCase(deps()).execute({
                actorTelegramId: STRANGER_TG,
                businessId: "biz-1",
                courierId,
                dispatcher: true,
            }),
        ).rejects.toThrow(ForbiddenError)
        await makeDispatcher(courierId)
        const list = await new ListCouriersUseCase(deps()).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
        })
        expect(list).toMatchObject([{ id: courierId, dispatcher: true }])
    })

    it("the whole way: hand over, pack, «Jo'natdim» by post, a note, delivered", async () => {
        const courierId = await hire()
        await makeDispatcher(courierId)
        const order = await paidOrder()
        expect(order).toMatchObject({ status: OrderStatus.PREPARING, needsCourierChoice: true })
        // Nobody on it yet: «Tayyor» waits for the courier choice.
        await expect(advance(order, OrderStatus.READY)).rejects.toMatchObject({
            rule: "COURIER_NOT_CHOSEN",
        })
        const handed = await new AssignCourierUseCase(deps()).execute({ ...ids(order), courierId })
        expect(handed).toMatchObject({ dispatcher: true, needsCourierChoice: false })
        await advance(order, OrderStatus.READY)
        // The way is the dispatcher's word: a bare step is refused, from the bot too.
        await expect(courierStep(order, OrderStatus.PICKED_UP)).rejects.toMatchObject({
            rule: "SEND_WAY_REQUIRED",
        })
        await expect(advance(order, OrderStatus.PICKED_UP)).rejects.toMatchObject({
            rule: "SEND_WAY_REQUIRED",
        })
        const send = new SendOrderUseCase(deps())
        await expect(
            send.execute({ telegramId: STRANGER_TG, orderId: order.id, via: SendWay.POST }),
        ).rejects.toThrow(ForbiddenError)
        const sent = await send.execute({
            telegramId: DISPATCHER_TG,
            orderId: order.id,
            via: SendWay.POST,
            note: "Trek: UZ123456",
        })
        expect(sent).toMatchObject({
            status: OrderStatus.PICKED_UP,
            sentVia: SendWay.POST,
            deliveryNotes: [{ at: expect.any(String), text: "Trek: UZ123456" }],
        })
        const noted = await new AddDeliveryNoteUseCase(deps()).execute({
            telegramId: DISPATCHER_TG,
            orderId: order.id,
            text: "Qarshiga yetdi, ertaga olib boriladi",
        })
        expect(noted.deliveryNotes.map((note) => note.text)).toEqual([
            "Trek: UZ123456",
            "Qarshiga yetdi, ertaga olib boriladi",
        ])
        expect((await courierStep(order, OrderStatus.DELIVERED)).status).toBe(OrderStatus.DELIVERED)
    })

    it("nobody else writes notes; an order that does not exist is not found", async () => {
        const courierId = await hire()
        await makeDispatcher(courierId)
        const order = await paidOrder()
        const note = new AddDeliveryNoteUseCase(deps())
        // Not handed to them yet.
        await expect(
            note.execute({ telegramId: DISPATCHER_TG, orderId: order.id, text: "Salom" }),
        ).rejects.toThrow(ForbiddenError)
        await expect(
            note.execute({ telegramId: DISPATCHER_TG, orderId: "nope", text: "Salom" }),
        ).rejects.toThrow(EntityNotFoundError)
    })

    it("«O'zim yetkazaman» brings the owner's own steps back", async () => {
        await hire()
        const order = await paidOrder()
        const mine = new DeliverMyselfUseCase(deps())
        await expect(mine.execute(ids(order, STRANGER_TG))).rejects.toThrow(ForbiddenError)
        await expect(mine.execute({ ...ids(order), orderId: "nope" })).rejects.toThrow(
            EntityNotFoundError,
        )
        expect(await mine.execute(ids(order))).toMatchObject({
            ownerDelivers: true,
            needsCourierChoice: false,
        })
        await advance(order, OrderStatus.READY)
        await advance(order, OrderStatus.PICKED_UP)
        expect((await advance(order, OrderStatus.DELIVERED)).status).toBe(OrderStatus.DELIVERED)
    })

    it("a shop without couriers: the owner says «O'zim yetkazaman» before «Tayyor»", async () => {
        const order = await paidOrder()
        expect(order.needsCourierChoice).toBe(true)
        await expect(advance(order, OrderStatus.READY)).rejects.toMatchObject({
            rule: "COURIER_NOT_CHOSEN",
        })
        expect(await new AutoAssignOnlyCourierUseCase(deps()).execute({ orderId: order.id })).toBe(
            null,
        )
        await new DeliverMyselfUseCase(deps()).execute(ids(order))
        await advance(order, OrderStatus.READY)
        expect((await advance(order, OrderStatus.PICKED_UP)).status).toBe(OrderStatus.PICKED_UP)
    })

    it("the shop's only courier is chosen by itself once the order is accepted", async () => {
        const courierId = await hire()
        const order = await paidOrder()
        const auto = new AutoAssignOnlyCourierUseCase(deps())
        const assigned = await auto.execute({ orderId: order.id })
        expect(assigned).toMatchObject({ courierId, needsCourierChoice: false })
        // Once on it, nothing more to choose: a second call changes nothing.
        expect(await auto.execute({ orderId: order.id })).toBeNull()
        await advance(order, OrderStatus.READY)
        expect((await orders.findById(order.id))?.status).toBe(OrderStatus.READY)
    })

    it("the only courier off shift, or a dispatcher and cash: the owner chooses", async () => {
        await hire()
        await new SetShiftUseCase(deps()).execute({ telegramId: DISPATCHER_TG, onShift: false })
        const order = await paidOrder()
        const auto = new AutoAssignOnlyCourierUseCase(deps())
        expect(await auto.execute({ orderId: order.id })).toBeNull()
        expect((await orders.findById(order.id))?.courierId).toBeUndefined()
        // A pending order is not the shop's to give yet.
        expect(await auto.execute({ orderId: "nope" })).toBeNull()
    })

    it("two couriers: the owner always picks one", async () => {
        await hire()
        const second = await new CreateCourierInviteUseCase(deps()).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
        })
        const joined = await new JoinAsCourierUseCase(deps()).execute({
            code: second.code,
            user: { id: 6006, firstName: "Bobur" },
        })
        await courierSharesPhone(couriers, 6006)
        await new ReviewCourierUseCase(deps()).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            courierId: joined.courier.id,
            approve: true,
        })
        const order = await paidOrder()
        expect(await new AutoAssignOnlyCourierUseCase(deps()).execute({ orderId: order.id })).toBe(
            null,
        )
    })

    it("a delivery the customer pays to the carrier: no fee, and no network", async () => {
        const shops = new UpdateShopUseCase(businesses, clock)
        await shops.execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            patch: { delivery: { fee: 10_000, customerPaysCarrier: true } },
        })
        const order = await paidOrder()
        expect(order).toMatchObject({ deliveryFee: 0, customerPaysCarrier: true })
        expect(
            await new AutoRequestNetworkUseCase(deps()).execute({ orderId: order.id }),
        ).toBeNull()
        // An older app saving the delivery without the switch keeps it as it was.
        await shops.execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            patch: { delivery: { fee: 10_000 } },
        })
        expect((await businesses.findById("biz-1"))?.delivery.customerPaysCarrier).toBe(true)
    })
})

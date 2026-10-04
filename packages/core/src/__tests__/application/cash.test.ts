import { beforeEach, describe, expect, it } from "vitest"

import {
    AssignCourierUseCase,
    CreateCourierInviteUseCase,
    GetCourierHomeUseCase,
    JoinAsCourierUseCase,
    ReviewCourierUseCase,
    SetShiftUseCase,
} from "../../application/use-cases/courier/courier.use-cases.js"
import {
    ConfirmPaymentUseCase,
    GetMoneyReportUseCase,
    ReceiveCourierCashUseCase,
} from "../../application/use-cases/money/money.use-cases.js"
import {
    AutoRequestNetworkUseCase,
    RequestNetworkCourierUseCase,
} from "../../application/use-cases/network/network.use-cases.js"
import {
    AdvanceOrderUseCase,
    MarkTransferSentUseCase,
} from "../../application/use-cases/order/order.use-cases.js"
import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import { GetShopBySlugUseCase } from "../../application/use-cases/shop/get-shop.use-case.js"
import { UpdateShopUseCase } from "../../application/use-cases/shop/update-shop.use-case.js"
import { OrderStatus } from "../../domain/enums/order-status.js"
import { PaymentMethod, PaymentOptions, PaymentStatus } from "../../domain/enums/payment.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import {
    CUSTOMER_TG,
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
    InMemoryDistricts,
    InMemoryTrips,
    InMemoryOrders,
    InMemoryProducts,
    InMemoryReceipts,
    fixedClock,
} from "../in-memory.js"

import type { OrderDTO } from "../../application/dtos/order.dto.js"

const COURIER_TG = 5005

describe("cash: the shop chooses, the courier collects, the owner takes it per order", () => {
    const clock = fixedClock(new Date())
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts
    let customers: InMemoryCustomers
    let orders: InMemoryOrders
    let couriers: InMemoryCouriers
    let courierId: string

    const deps = () => ({
        businesses,
        customers,
        couriers,
        orders,
        products,
        districts: new InMemoryDistricts(),
        receipts: new InMemoryReceipts(),
        trips: new InMemoryTrips(orders),
        clock,
    })
    const ids = (order: OrderDTO, actorTelegramId = OWNER_TG) => ({
        actorTelegramId,
        businessId: "biz-1",
        orderId: order.id,
    })

    const setOptions = (paymentOptions: PaymentOptions) =>
        new UpdateShopUseCase(businesses, clock).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            patch: { paymentOptions },
        })

    const place = (paymentMethod?: PaymentMethod): Promise<OrderDTO> =>
        new PlaceOrderUseCase(deps()).execute({
            user: { id: CUSTOMER_TG, firstName: "Aziz" },
            businessId: "biz-1",
            items: [{ productId: "prod-1", quantity: 2 }],
            address: "Navoiy 12",
            paymentMethod,
        })

    const advance = (order: OrderDTO, to: OrderStatus, actor = OWNER_TG): Promise<OrderDTO> =>
        new AdvanceOrderUseCase(deps()).execute({ ...ids(order, actor), to })

    const assign = (order: OrderDTO) =>
        new AssignCourierUseCase(deps()).execute({ ...ids(order), courierId })

    /** Accepted without money, cooked, carried and delivered by the shop's courier. */
    async function deliverByCourier(order: OrderDTO): Promise<OrderDTO> {
        await advance(order, OrderStatus.ACCEPTED)
        await assign(order)
        await advance(order, OrderStatus.PREPARING)
        await advance(order, OrderStatus.READY)
        await advance(order, OrderStatus.PICKED_UP, COURIER_TG)
        return advance(order, OrderStatus.DELIVERED, COURIER_TG)
    }

    const report = () =>
        new GetMoneyReportUseCase(deps()).execute({
            actorTelegramId: OWNER_TG,
            businessId: "biz-1",
            period: "today",
        })

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        products = new InMemoryProducts()
        customers = new InMemoryCustomers()
        orders = new InMemoryOrders()
        couriers = new InMemoryCouriers()
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
    })

    it("a card shop: a transfer by default, cash is refused", async () => {
        expect((await place()).payment.method).toBe(PaymentMethod.CARD_TRANSFER)
        await expect(place(PaymentMethod.CASH)).rejects.toMatchObject({
            rule: "PAYMENT_METHOD_UNAVAILABLE",
        })
    })

    it("a cash shop takes orders without a card; the storefront offers only cash", async () => {
        await businesses.save(makeBusiness({ card: false }))
        const shop = await setOptions(PaymentOptions.CASH)
        expect(shop).toMatchObject({ paymentOptions: "cash", paymentMethods: ["cash"] })
        const storefront = await new GetShopBySlugUseCase(businesses, clock).execute("osh-markaz")
        expect(storefront.isOpen).toBe(true)
        const order = await place()
        expect(order.payment).toMatchObject({ method: "cash", status: "unpaid" })
        expect(order.payment.card).toBeUndefined()
        await expect(place(PaymentMethod.CARD_TRANSFER)).rejects.toMatchObject({
            rule: "PAYMENT_METHOD_UNAVAILABLE",
        })
    })

    it("both: the customer picks one; without a card only cash is left", async () => {
        await setOptions(PaymentOptions.BOTH)
        expect((await place(PaymentMethod.CASH)).payment.method).toBe(PaymentMethod.CASH)
        expect((await place(PaymentMethod.CARD_TRANSFER)).payment.method).toBe(
            PaymentMethod.CARD_TRANSFER,
        )
        expect((await place()).payment.method).toBe(PaymentMethod.CARD_TRANSFER)
        await businesses.save(makeBusiness({ card: false }))
        const shop = await setOptions(PaymentOptions.BOTH)
        expect(shop.paymentMethods).toEqual(["cash"])
        expect((await place()).payment.method).toBe(PaymentMethod.CASH)
    })

    it("a cash order starts at once; transfer steps are refused on it", async () => {
        await setOptions(PaymentOptions.CASH)
        const order = await place()
        await expect(
            new MarkTransferSentUseCase(deps()).execute({
                telegramId: CUSTOMER_TG,
                businessId: "biz-1",
                orderId: order.id,
                receipt: { bytes: new Uint8Array([1]), contentType: "image/webp" },
            }),
        ).rejects.toMatchObject({ rule: "NOT_A_TRANSFER" })
        await expect(new ConfirmPaymentUseCase(deps()).execute(ids(order))).rejects.toMatchObject({
            rule: "NOT_A_TRANSFER",
        })
        const accepted = await advance(order, OrderStatus.ACCEPTED)
        expect(accepted).toMatchObject({ status: "accepted", payment: { status: "unpaid" } })
    })

    it("the courier collects it; the owner sees it per courier and takes it per order", async () => {
        await setOptions(PaymentOptions.CASH)
        const first = await deliverByCourier(await place())
        const second = await deliverByCourier(await place())
        expect(first.payment).toMatchObject({
            status: PaymentStatus.PAID,
            cashCourierId: courierId,
            withCourier: true,
        })

        let money = await report()
        expect(money.totals).toMatchObject({ paid: 160_000, paidCash: 160_000 })
        expect(money.courierCash).toHaveLength(1)
        expect(money.courierCash[0]).toMatchObject({ courierId, courierName: "Jasur" })
        expect(money.courierCash[0]?.total).toBe(160_000)
        expect(money.courierCash[0]?.orders.map((o) => o.id)).toEqual([first.id, second.id])
        let home = await new GetCourierHomeUseCase(deps()).execute({ telegramId: COURIER_TG })
        expect(home.shops[0]?.cashToHand).toBe(160_000)

        const receive = new ReceiveCourierCashUseCase(deps())
        await expect(receive.execute(ids(first, STRANGER_TG))).rejects.toThrow(ForbiddenError)
        const taken = await receive.execute(ids(first))
        expect(taken.payment).toMatchObject({ withCourier: false })
        expect(taken.payment.cashReceivedAt).toBeDefined()
        await expect(receive.execute(ids(first))).rejects.toMatchObject({
            rule: "CASH_NOT_WITH_COURIER",
        })

        money = await report()
        expect(money.courierCash[0]?.total).toBe(80_000)
        home = await new GetCourierHomeUseCase(deps()).execute({ telegramId: COURIER_TG })
        expect(home.shops[0]?.cashToHand).toBe(80_000)
    })

    it("the owner delivered it: the money is in the shop at once", async () => {
        await setOptions(PaymentOptions.CASH)
        const order = await place()
        for (const to of [
            OrderStatus.ACCEPTED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.PICKED_UP,
            OrderStatus.DELIVERED,
        ]) {
            await advance(order, to)
        }
        const stored = orders.items.get(order.id)
        expect(stored?.payment).toMatchObject({ status: PaymentStatus.PAID })
        expect(stored?.payment.cashReceivedAt).toBeDefined()
        expect((await report()).courierCash).toEqual([])
    })

    it("a cash order never goes to the district network", async () => {
        await setOptions(PaymentOptions.CASH)
        const order = await place()
        await advance(order, OrderStatus.ACCEPTED)
        expect(await new AutoRequestNetworkUseCase(deps()).execute({ orderId: order.id })).toBe(
            null,
        )
        await expect(
            new RequestNetworkCourierUseCase(deps()).execute(ids(order)),
        ).rejects.toMatchObject({ rule: "CASH_NOT_FOR_NETWORK" })
    })
})

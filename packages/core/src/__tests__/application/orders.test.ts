import { beforeEach, describe, expect, it } from "vitest"

import {
    AdvanceOrderUseCase,
    CancelOrderUseCase,
    GetOrderUseCase,
    ListMyOrdersUseCase,
    ListShopOrdersUseCase,
} from "../../application/use-cases/order/order.use-cases.js"
import { ConfirmPaymentUseCase } from "../../application/use-cases/money/money.use-cases.js"
import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import { OrderChannel } from "../../domain/enums/order-channel.js"
import { OrderStatus } from "../../domain/enums/order-status.js"
import { BusinessRuleViolationError } from "../../domain/errors/business-rule.error.js"
import { ConflictError } from "../../domain/errors/conflict.error.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { InvalidOrderTransitionError } from "../../domain/errors/invalid-transition.error.js"
import { EntityNotFoundError } from "../../domain/errors/not-found.error.js"
import { Location } from "../../domain/value-objects/location.js"
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

import type { PlaceOrderInput } from "../../application/use-cases/order/place-order.use-case.js"

const customerUser = { id: CUSTOMER_TG, firstName: "Aziz" }

describe("order use cases", () => {
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts
    let customers: InMemoryCustomers
    let orders: InMemoryOrders
    let couriers: InMemoryCouriers
    let placeOrder: PlaceOrderUseCase

    function input(overrides: Partial<PlaceOrderInput> = {}): PlaceOrderInput {
        return {
            user: customerUser,
            businessId: "biz-1",
            items: [{ productId: "prod-1", quantity: 2 }],
            address: "Navoiy 12",
            landmark: "Maktab yonida",
            ...overrides,
        }
    }

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        products = new InMemoryProducts()
        customers = new InMemoryCustomers()
        orders = new InMemoryOrders()
        couriers = new InMemoryCouriers()
        await businesses.save(
            makeBusiness({ delivery: { fee: Money.of(10_000), freeFrom: Money.of(200_000) } }),
        )
        await products.save(makeProduct())
        await products.save(makeProduct({ id: "prod-2", name: "Somsa", price: 8_000 }))
        await customers.save(makeCustomer())
        // The customer sent their phone to this shop's bot.
        await customers.sharePhoneWith("cust-1", "biz-1", NOON_MONDAY_UZ)
        placeOrder = new PlaceOrderUseCase({
            businesses,
            products,
            customers,
            orders,
            clock: fixedClock(NOON_MONDAY_UZ),
        })
    })

    describe("PlaceOrder", () => {
        it("takes prices and names from the database, never from the client", async () => {
            const tampered = {
                ...input(),
                items: [{ productId: "prod-1", quantity: 2, unitPrice: 1, productName: "Free" }],
            }
            const order = await placeOrder.execute(tampered)
            expect(order.items[0]).toMatchObject({ name: "Osh", unitPrice: 35_000, total: 70_000 })
            expect(order).toMatchObject({
                number: 1,
                status: OrderStatus.PENDING,
                subtotal: 70_000,
                deliveryFee: 10_000,
                total: 80_000,
                customerName: "Aziz",
                customerPhone: "+998901234567",
                nextStatus: OrderStatus.ACCEPTED,
            })
            expect(customers.links.size).toBe(1)
        })

        it("merges duplicate lines and numbers orders per shop", async () => {
            const first = await placeOrder.execute(
                input({
                    items: [
                        { productId: "prod-2", quantity: 1 },
                        { productId: "prod-2", quantity: 2 },
                    ],
                }),
            )
            expect(first.items).toHaveLength(1)
            expect(first.items[0]?.quantity).toBe(3)
            const second = await placeOrder.execute(input())
            expect(second.number).toBe(2)
        })

        it("free delivery above the threshold", async () => {
            const order = await placeOrder.execute(
                input({ items: [{ productId: "prod-1", quantity: 6 }] }),
            )
            expect(order.deliveryFee).toBe(0)
        })

        it("rejects foreign, unknown and unavailable products", async () => {
            await products.save(makeProduct({ id: "foreign", businessId: "biz-2" }))
            await expect(
                placeOrder.execute(input({ items: [{ productId: "foreign", quantity: 1 }] })),
            ).rejects.toThrow(EntityNotFoundError)
            await expect(
                placeOrder.execute(input({ items: [{ productId: "ghost", quantity: 1 }] })),
            ).rejects.toThrow(EntityNotFoundError)

            const product = await products.findById("prod-1")
            product?.setAvailability(false)
            await expect(placeOrder.execute(input())).rejects.toThrow(/not available/)
        })

        it("rejects empty orders and orders without a phone", async () => {
            await expect(placeOrder.execute(input({ items: [] }))).rejects.toThrow(
                BusinessRuleViolationError,
            )
            await expect(
                placeOrder.execute(input({ user: { id: 4242, firstName: "New" } })),
            ).rejects.toThrow(/phone/)
            expect(orders.items.size).toBe(0)
        })

        it("needs the phone sent to this shop; the showcase hands it over", async () => {
            // The phone is known, but it was sent to another shop only. The owner of biz-1 can
            // sign any user id with their own bot token, so the phone must not reach them.
            customers.phoneShares.clear()
            await customers.sharePhoneWith("cust-1", "other-shop", NOON_MONDAY_UZ)
            await expect(placeOrder.execute(input())).rejects.toThrow(/phone/)

            // Through the showcase the Zumda bot signed the user: the order gives this shop the
            // phone.
            const business = await businesses.findById("biz-1")
            business?.joinMarketplace(500, NOON_MONDAY_UZ)
            const order = await placeOrder.execute(input({ channel: OrderChannel.MARKETPLACE }))
            expect(order.customerPhone).toBe("+998901234567")
            expect(await customers.hasSharedPhoneWith("cust-1", "biz-1")).toBe(true)
        })

        it("respects the shop being paused", async () => {
            const business = await businesses.findById("biz-1")
            business?.setAcceptingOrders(false)
            await expect(placeOrder.execute(input())).rejects.toThrow(/not accepting/)
        })

        it("checks minimum order and delivery zone", async () => {
            const business = await businesses.findById("biz-1")
            business?.updateDelivery({ fee: Money.of(0), minOrder: Money.of(100_000) })
            await expect(placeOrder.execute(input())).rejects.toThrow(/Minimum/)

            business?.updateDelivery({ fee: Money.of(0), radiusMeters: 1_000 })
            business?.updateProfile({ location: Location.create(41.3111, 69.2797) })
            await expect(
                placeOrder.execute(input({ location: { latitude: 41.4, longitude: 69.5 } })),
            ).rejects.toThrow(/delivery zone/)
            await expect(
                placeOrder.execute(input({ location: { latitude: 41.3115, longitude: 69.28 } })),
            ).resolves.toBeDefined()
        })

        it("retries when another order took the number", async () => {
            orders.collisions = 1
            const order = await placeOrder.execute(input())
            expect(order.number).toBe(1)
            orders.collisions = 3
            await expect(placeOrder.execute(input())).rejects.toThrow(ConflictError)
        })
    })

    describe("after placing", () => {
        let orderId: string

        beforeEach(async () => {
            orderId = (await placeOrder.execute(input())).id
        })

        function deps(): {
            businesses: InMemoryBusinesses
            customers: InMemoryCustomers
            couriers: InMemoryCouriers
            orders: InMemoryOrders
        } {
            return { businesses, customers, couriers, orders }
        }

        it("only the owner and the customer can see the order", async () => {
            const get = new GetOrderUseCase(deps())
            expect(
                (await get.execute({ businessId: "biz-1", telegramId: OWNER_TG, orderId })).id,
            ).toBe(orderId)
            expect(
                (await get.execute({ businessId: "biz-1", telegramId: CUSTOMER_TG, orderId })).id,
            ).toBe(orderId)
            await expect(
                get.execute({ businessId: "biz-1", telegramId: STRANGER_TG, orderId }),
            ).rejects.toThrow(ForbiddenError)
            await expect(
                get.execute({ businessId: "biz-1", telegramId: OWNER_TG, orderId: "nope" }),
            ).rejects.toThrow(EntityNotFoundError)
        })

        it("an order is visible only inside its own shop", async () => {
            const get = new GetOrderUseCase(deps())
            const cancel = new CancelOrderUseCase(deps())
            const advance = new AdvanceOrderUseCase(deps())
            const elsewhere = { businessId: "biz-2", orderId }
            await expect(get.execute({ ...elsewhere, telegramId: CUSTOMER_TG })).rejects.toThrow(
                EntityNotFoundError,
            )
            await expect(cancel.execute({ ...elsewhere, telegramId: CUSTOMER_TG })).rejects.toThrow(
                EntityNotFoundError,
            )
            await expect(
                advance.execute({
                    ...elsewhere,
                    actorTelegramId: OWNER_TG,
                    to: OrderStatus.ACCEPTED,
                }),
            ).rejects.toThrow(EntityNotFoundError)
        })

        it("owner advances step by step once paid; a stale button fails", async () => {
            const advance = new AdvanceOrderUseCase(deps())
            await expect(
                advance.execute({
                    businessId: "biz-1",
                    actorTelegramId: OWNER_TG,
                    orderId,
                    to: OrderStatus.ACCEPTED,
                }),
            ).rejects.toThrow(BusinessRuleViolationError)
            const accepted = await new ConfirmPaymentUseCase({
                businesses,
                orders,
                clock: fixedClock(NOON_MONDAY_UZ),
            }).execute({ businessId: "biz-1", actorTelegramId: OWNER_TG, orderId })
            expect(accepted.nextStatus).toBe(OrderStatus.PREPARING)
            await expect(
                advance.execute({
                    businessId: "biz-1",
                    actorTelegramId: OWNER_TG,
                    orderId,
                    to: OrderStatus.ACCEPTED,
                }),
            ).rejects.toThrow(InvalidOrderTransitionError)
            await expect(
                advance.execute({
                    businessId: "biz-1",
                    actorTelegramId: CUSTOMER_TG,
                    orderId,
                    to: OrderStatus.PREPARING,
                }),
            ).rejects.toThrow(ForbiddenError)
        })

        it("customer cancels while pending; owner cancels later", async () => {
            const cancel = new CancelOrderUseCase(deps())
            const byCustomer = await cancel.execute({
                businessId: "biz-1",
                telegramId: CUSTOMER_TG,
                orderId,
            })
            expect(byCustomer.cancelledBy).toBe("customer")

            const second = (await placeOrder.execute(input())).id
            await new ConfirmPaymentUseCase({
                businesses,
                orders,
                clock: fixedClock(NOON_MONDAY_UZ),
            }).execute({ businessId: "biz-1", actorTelegramId: OWNER_TG, orderId: second })
            await expect(
                cancel.execute({ businessId: "biz-1", telegramId: CUSTOMER_TG, orderId: second }),
            ).rejects.toThrow(BusinessRuleViolationError)
            const byOwner = await cancel.execute({
                businessId: "biz-1",
                telegramId: OWNER_TG,
                orderId: second,
                reason: "Tugadi",
            })
            expect(byOwner).toMatchObject({ cancelledBy: "owner", cancelReason: "Tugadi" })
            await expect(
                cancel.execute({ businessId: "biz-1", telegramId: STRANGER_TG, orderId: second }),
            ).rejects.toThrow(ForbiddenError)
        })

        it("lists orders for the customer and for the shop", async () => {
            const mine = await new ListMyOrdersUseCase(customers, orders).execute({
                telegramId: CUSTOMER_TG,
                businessId: "biz-1",
            })
            expect(mine.meta.total).toBe(1)
            const none = await new ListMyOrdersUseCase(customers, orders).execute({
                telegramId: STRANGER_TG,
                businessId: "biz-1",
            })
            expect(none).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } })

            const shopOrders = new ListShopOrdersUseCase(businesses, orders)
            const active = await shopOrders.execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                filter: "active",
            })
            expect(active.meta.total).toBe(1)
            const done = await shopOrders.execute({
                actorTelegramId: OWNER_TG,
                businessId: "biz-1",
                filter: "done",
            })
            expect(done.meta.total).toBe(0)
            const all = await shopOrders.execute({ actorTelegramId: OWNER_TG, businessId: "biz-1" })
            expect(all.meta.total).toBe(1)
            await expect(
                shopOrders.execute({ actorTelegramId: STRANGER_TG, businessId: "biz-1" }),
            ).rejects.toThrow(ForbiddenError)
        })
    })
})

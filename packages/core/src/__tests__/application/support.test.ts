import { beforeEach, describe, expect, it } from "vitest"

import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import { GetShopBySlugUseCase } from "../../application/use-cases/shop/get-shop.use-case.js"
import {
    ConnectSupportGroupUseCase,
    DisconnectSupportGroupUseCase,
    FindSupportCustomerUseCase,
    GetSupportGroupUseCase,
    LoseSupportGroupUseCase,
    OpenSupportThreadUseCase,
    SupportContextUseCase,
} from "../../application/use-cases/support/support.use-cases.js"
import { OrderStatus } from "../../domain/enums/order-status.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import { SupportGroup, supportTopicName } from "../../domain/value-objects/support-group.js"
import { ValidationError } from "../../domain/errors/validation.error.js"
import {
    CUSTOMER_TG,
    NOON_MONDAY_UZ,
    OWNER_TG,
    PIN,
    STRANGER_TG,
    makeBusiness,
    makeCustomer,
    makeProduct,
} from "../fixtures.js"
import {
    InMemoryBusinesses,
    InMemoryCustomers,
    InMemoryOrders,
    InMemoryProducts,
    fixedClock,
} from "../in-memory.js"
import {
    FakeSupportTopics,
    InMemorySupportGroups,
    InMemorySupportThreads,
} from "../in-memory-support.js"

import type { BotMadeGroupAdmin } from "../../application/use-cases/support/support.use-cases.js"
import type { Business } from "../../domain/entities/business.js"

const NOW = new Date("2026-11-24T09:00:00Z")
const GROUP = -1005550001
const OTHER_GROUP = -1005550002

describe("the support group", () => {
    let businesses: InMemoryBusinesses
    let groups: InMemorySupportGroups
    let shop: Business

    const connect = (
        input: Partial<BotMadeGroupAdmin> = {},
    ): ReturnType<ConnectSupportGroupUseCase["execute"]> =>
        new ConnectSupportGroupUseCase({ businesses, supportGroups: groups }).execute({
            businessId: shop.id,
            actorTelegramId: OWNER_TG,
            chatId: GROUP,
            title: "ABC savollar",
            isForum: true,
            canManageTopics: true,
            now: NOW,
            ...input,
        })

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        groups = new InMemorySupportGroups()
        shop = makeBusiness()
        await businesses.save(shop)
    })

    it("the owner's group with topics is connected; a new one replaces it", async () => {
        expect((await connect()).kind).toBe("connected")
        const second = await connect({ chatId: OTHER_GROUP, title: "Yangi" })
        expect(second.kind === "connected" && second.replaced?.chatId).toBe(GROUP)
        expect((await groups.find(shop.id))?.title).toBe("Yangi")
    })

    it("the same group again keeps it under its new title", async () => {
        await connect()
        const again = await connect({ actorTelegramId: STRANGER_TG, title: "ABC yordam" })
        expect(again.kind).toBe("unchanged")
        expect((await groups.find(shop.id))?.title).toBe("ABC yordam")
    })

    it("the same group without the right to make topics is lost", async () => {
        await connect()
        const lost = await connect({ canManageTopics: false })
        expect(lost.kind).toBe("lost")
        expect(await groups.find(shop.id)).toBeNull()
    })

    it("someone else, a demo shop, a group without topics or without the right is refused", async () => {
        expect(await connect({ actorTelegramId: STRANGER_TG })).toEqual({
            kind: "refused",
            why: "notOwner",
        })
        expect(await connect({ isForum: false })).toEqual({ kind: "refused", why: "notForum" })
        expect(await connect({ canManageTopics: false })).toEqual({
            kind: "refused",
            why: "noTopics",
        })
        shop.makeDemo(NOW)
        expect(await connect()).toEqual({ kind: "refused", why: "demo" })
        expect(await groups.find(shop.id)).toBeNull()
    })

    it("losing it: only news about the group connected now counts", async () => {
        await connect()
        const lose = new LoseSupportGroupUseCase(groups)
        expect(await lose.execute({ businessId: shop.id, chatId: OTHER_GROUP })).toBeNull()
        expect((await lose.execute({ businessId: shop.id, chatId: GROUP }))?.chatId).toBe(GROUP)
        expect(await groups.find(shop.id)).toBeNull()
    })

    it("«Guruhni ajratish» and the group's card are the owner's only", async () => {
        await connect()
        const deps = { businesses, supportGroups: groups }
        const asStranger = { actorTelegramId: STRANGER_TG, businessId: shop.id }
        await expect(new GetSupportGroupUseCase(deps).execute(asStranger)).rejects.toBeInstanceOf(
            ForbiddenError,
        )
        await expect(
            new DisconnectSupportGroupUseCase(deps).execute(asStranger),
        ).rejects.toBeInstanceOf(ForbiddenError)
        const asOwner = { actorTelegramId: OWNER_TG, businessId: shop.id }
        expect((await new GetSupportGroupUseCase(deps).execute(asOwner))?.chatId).toBe(GROUP)
        expect((await new DisconnectSupportGroupUseCase(deps).execute(asOwner))?.chatId).toBe(GROUP)
        expect(await new DisconnectSupportGroupUseCase(deps).execute(asOwner)).toBeNull()
    })

    it("a group's id is negative and its title is not empty", () => {
        const make = (chatId: number, title: string): SupportGroup =>
            SupportGroup.connect({ businessId: "b", chatId, title, connectedAt: NOW })
        expect(() => make(42, "ABC")).toThrow(ValidationError)
        expect(() => make(GROUP, " ")).toThrow(ValidationError)
        expect(make(GROUP, "ABC").isSameChat(GROUP)).toBe(true)
    })

    it("the storefront says whether the shop answers messages", async () => {
        const clock = fixedClock(NOW)
        const customers = new InMemoryCustomers()
        const plain = await new GetShopBySlugUseCase(businesses, clock, customers).execute(
            shop.slug.value,
        )
        expect(plain.supportChat).toBe(false)
        const read = new GetShopBySlugUseCase(businesses, clock, customers, groups)
        expect((await read.execute(shop.slug.value)).supportChat).toBe(false)
        await connect()
        expect((await read.execute(shop.slug.value)).supportChat).toBe(true)
    })
})

describe("a customer's topic", () => {
    let groups: InMemorySupportGroups
    let threads: InMemorySupportThreads
    let topics: FakeSupportTopics

    const open = (staleThreadId?: number): ReturnType<OpenSupportThreadUseCase["execute"]> =>
        new OpenSupportThreadUseCase({
            supportGroups: groups,
            supportThreads: threads,
            topics,
        }).execute({
            businessId: "biz-1",
            customerTelegramId: CUSTOMER_TG,
            name: "Aziz Karimov",
            ...(staleThreadId === undefined ? {} : { staleThreadId }),
            now: NOW,
        })

    const find = (chatId: number, threadId: number): Promise<number | null> =>
        new FindSupportCustomerUseCase({ supportGroups: groups, supportThreads: threads }).execute({
            businessId: "biz-1",
            chatId,
            threadId,
        })

    beforeEach(async () => {
        groups = new InMemorySupportGroups()
        threads = new InMemorySupportThreads()
        topics = new FakeSupportTopics()
        await groups.save(
            SupportGroup.connect({
                businessId: "biz-1",
                chatId: GROUP,
                title: "ABC savollar",
                connectedAt: NOW,
            }),
        )
    })

    it("is made on the first message, then the same one is used", async () => {
        const first = await open()
        expect(first).toMatchObject({ kind: "thread", threadId: 100, created: true })
        expect(topics.opened).toEqual([{ chatId: GROUP, name: "Aziz Karimov", threadId: 100 }])
        expect(await open()).toMatchObject({ kind: "thread", threadId: 100, created: false })
        expect(topics.opened).toHaveLength(1)
    })

    it("a shop without a support group answers as before", async () => {
        await groups.remove("biz-1")
        expect(await open()).toEqual({ kind: "none" })
        expect(topics.opened).toHaveLength(0)
    })

    it("a topic deleted in Telegram is made again", async () => {
        await open()
        expect(await open(100)).toMatchObject({ kind: "thread", threadId: 101, created: true })
        expect(await find(GROUP, 101)).toBe(CUSTOMER_TG)
        expect(await find(GROUP, 100)).toBeNull()
    })

    it("two messages at once: the topic written first wins, the spare one goes", async () => {
        threads.beatenBy = {
            businessId: "biz-1",
            chatId: GROUP,
            customerTelegramId: CUSTOMER_TG,
            threadId: 77,
            createdAt: NOW,
        }
        expect(await open()).toMatchObject({ kind: "thread", threadId: 77, created: false })
        expect(topics.discarded).toEqual([100])
    })

    it("the bot that may not make topics any more forgets the group", async () => {
        topics.noRights = true
        expect((await open()).kind).toBe("lost")
        expect(await groups.find("biz-1")).toBeNull()
    })

    it("a reply finds its customer only in a topic of the group connected now", async () => {
        await open()
        expect(await find(GROUP, 100)).toBe(CUSTOMER_TG)
        expect(await find(GROUP, 1)).toBeNull()
        expect(await find(OTHER_GROUP, 100)).toBeNull()
    })

    it("a topic is named as the customer is in Telegram", () => {
        expect(supportTopicName({ firstName: " Aziz ", lastName: "Karimov" }, "Mijoz")).toBe(
            "Aziz Karimov",
        )
        expect(supportTopicName({ firstName: "" }, "Mijoz")).toBe("Mijoz")
        expect([...supportTopicName({ firstName: "😀".repeat(200) }, "Mijoz")]).toHaveLength(128)
    })
})

describe("what the shop's people see about the customer", () => {
    let businesses: InMemoryBusinesses
    let products: InMemoryProducts
    let customers: InMemoryCustomers
    let orders: InMemoryOrders
    let context: SupportContextUseCase

    beforeEach(async () => {
        businesses = new InMemoryBusinesses()
        products = new InMemoryProducts()
        customers = new InMemoryCustomers()
        orders = new InMemoryOrders()
        context = new SupportContextUseCase({ customers, orders, products })
        await businesses.save(makeBusiness())
        await businesses.save(makeBusiness({ id: "biz-2" }))
        await products.save(makeProduct({ name: "Fetr kitobcha" }))
        await products.save(makeProduct({ id: "prod-2", businessId: "biz-2" }))
    })

    const placeOrder = async (): Promise<string> => {
        await customers.save(makeCustomer())
        await customers.sharePhoneWith("cust-1", "biz-1", NOON_MONDAY_UZ)
        const placed = await new PlaceOrderUseCase({
            businesses,
            products,
            customers,
            orders,
            clock: fixedClock(NOON_MONDAY_UZ),
        }).execute({
            user: { id: CUSTOMER_TG, firstName: "Aziz" },
            businessId: "biz-1",
            items: [{ productId: "prod-1", quantity: 1 }],
            address: "Navoiy 12",
            location: PIN,
        })
        return placed.id
    }

    it("their last order at this shop, or nothing", async () => {
        expect(await context.lastOrder("biz-1", CUSTOMER_TG)).toBeNull()
        const orderId = await placeOrder()
        expect(await context.lastOrder("biz-1", CUSTOMER_TG)).toMatchObject({
            orderId,
            number: 1,
            status: OrderStatus.PENDING,
        })
        expect(await context.lastOrder("biz-2", CUSTOMER_TG)).toBeNull()
    })

    it("«Do'konga yozish» on their own order, or a product of this shop", async () => {
        const orderId = await placeOrder()
        const about = (
            input: { orderId?: string; productId?: string },
            who = CUSTOMER_TG,
        ): ReturnType<SupportContextUseCase["about"]> =>
            context.about({ businessId: "biz-1", customerTelegramId: who, ...input })
        expect(await about({ orderId })).toMatchObject({ kind: "order", order: { number: 1 } })
        expect(await about({ orderId }, STRANGER_TG)).toBeNull()
        expect(await about({ orderId: "nope" })).toBeNull()
        expect(await about({ productId: "prod-1" })).toEqual({
            kind: "product",
            productId: "prod-1",
            name: "Fetr kitobcha",
        })
        expect(await about({ productId: "prod-2" })).toBeNull()
        expect(await about({})).toBeNull()
    })
})

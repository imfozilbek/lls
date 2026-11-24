import { beforeEach, describe, expect, it } from "vitest"

import { PlaceOrderUseCase } from "../../application/use-cases/order/place-order.use-case.js"
import { GetShopBySlugUseCase } from "../../application/use-cases/shop/get-shop.use-case.js"
import {
    ConnectSupportGroupUseCase,
    DisconnectSupportGroupUseCase,
    FindSupportCustomerUseCase,
    GetSupportGroupUseCase,
    LoseSupportGroupUseCase,
    MarkSupportAnsweredUseCase,
    OpenSupportThreadUseCase,
    SupportContextUseCase,
    SupportTopicOfCustomerUseCase,
} from "../../application/use-cases/support/support.use-cases.js"
import { OrderStatus } from "../../domain/enums/order-status.js"
import { ForbiddenError } from "../../domain/errors/forbidden.error.js"
import {
    SupportGroup,
    shortPhone,
    supportTopicName,
} from "../../domain/value-objects/support-group.js"
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
    InMemorySupportRefusals,
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
    let refusals: InMemorySupportRefusals
    let shop: Business

    const connect = (
        input: Partial<BotMadeGroupAdmin> = {},
    ): ReturnType<ConnectSupportGroupUseCase["execute"]> =>
        new ConnectSupportGroupUseCase({
            businesses,
            supportGroups: groups,
            supportRefusals: refusals,
        }).execute({
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
        refusals = new InMemorySupportRefusals()
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
        expect((await refusals.find(shop.id))?.reason).toBe("lost")
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
        expect(await refusals.find(shop.id)).toMatchObject({
            reason: "noTopics",
            title: "ABC savollar",
        })
        shop.makeDemo(NOW)
        expect(await connect()).toEqual({ kind: "refused", why: "demo" })
        expect(await groups.find(shop.id)).toBeNull()
    })

    it("a refusal is remembered for the app until a group is connected", async () => {
        await connect({ isForum: false, title: "Oddiy guruh" })
        const deps = { businesses, supportGroups: groups, supportRefusals: refusals }
        const asOwner = { actorTelegramId: OWNER_TG, businessId: shop.id }
        const failed = await new GetSupportGroupUseCase(deps).execute(asOwner)
        expect(failed).toMatchObject({
            group: null,
            refusal: { reason: "notForum", title: "Oddiy guruh" },
        })
        await connect()
        const connected = await new GetSupportGroupUseCase(deps).execute(asOwner)
        expect(connected.refusal).toBeNull()
        expect(connected.group?.chatId).toBe(GROUP)
        expect(await refusals.find(shop.id)).toBeNull()
    })

    it("losing it: only news about the group connected now counts", async () => {
        await connect()
        const lose = new LoseSupportGroupUseCase({
            supportGroups: groups,
            supportRefusals: refusals,
        })
        const at = { businessId: shop.id, now: NOW }
        expect(await lose.execute({ ...at, chatId: OTHER_GROUP })).toBeNull()
        expect(await refusals.find(shop.id)).toBeNull()
        expect((await lose.execute({ ...at, chatId: GROUP }))?.chatId).toBe(GROUP)
        expect(await groups.find(shop.id)).toBeNull()
        expect(await refusals.find(shop.id)).toMatchObject({
            reason: "lost",
            title: "ABC savollar",
        })
    })

    it("«Guruhni ajratish» and the group's card are the owner's only", async () => {
        await connect()
        const deps = { businesses, supportGroups: groups, supportRefusals: refusals }
        const asStranger = { actorTelegramId: STRANGER_TG, businessId: shop.id }
        await expect(new GetSupportGroupUseCase(deps).execute(asStranger)).rejects.toBeInstanceOf(
            ForbiddenError,
        )
        await expect(
            new DisconnectSupportGroupUseCase(deps).execute(asStranger),
        ).rejects.toBeInstanceOf(ForbiddenError)
        const asOwner = { actorTelegramId: OWNER_TG, businessId: shop.id }
        expect((await new GetSupportGroupUseCase(deps).execute(asOwner)).group?.chatId).toBe(GROUP)
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
            nameOf: async () => "Aziz Karimov",
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
        expect(threads.items[0]).toMatchObject({ waitingSince: NOW, topicName: "Aziz Karimov" })
    })

    it("a topic made before names were kept is unnamed until it gets one", async () => {
        await threads.insert({
            businessId: "biz-1",
            chatId: GROUP,
            customerTelegramId: CUSTOMER_TG,
            threadId: 10,
            createdAt: NOW,
        })
        expect(await open()).toMatchObject({ threadId: 10, created: false, unnamed: true })
        await threads.saveName(GROUP, CUSTOMER_TG, "Aziz Karimov · @aziz")
        expect(await open()).toMatchObject({ threadId: 10, unnamed: false })
        expect(topics.opened).toHaveLength(0)
    })

    it("a new topic is named from the start", async () => {
        expect(await open()).toMatchObject({ created: true, unnamed: false })
        expect(await open()).toMatchObject({ created: false, unnamed: false })
    })

    it("waits for the shop's answer: ❓ turns once, ✅ turns once", async () => {
        const answered = (threadId = 100, chatId = GROUP): Promise<boolean> =>
            new MarkSupportAnsweredUseCase({
                supportGroups: groups,
                supportThreads: threads,
            }).execute({ businessId: "biz-1", chatId, threadId })
        await open()
        // A new topic waits from the start: its ❓ came with it.
        expect(await open()).toMatchObject({ nowWaiting: false })
        expect(await answered(100, OTHER_GROUP)).toBe(false)
        expect(await answered()).toBe(true)
        expect(await answered()).toBe(false)
        expect(await open()).toMatchObject({ nowWaiting: true })
        expect(await open()).toMatchObject({ nowWaiting: false })
    })

    it("the customer's topic is found by who they are", async () => {
        const of = (): ReturnType<SupportTopicOfCustomerUseCase["execute"]> =>
            new SupportTopicOfCustomerUseCase({
                supportGroups: groups,
                supportThreads: threads,
            }).execute({ businessId: "biz-1", customerTelegramId: CUSTOMER_TG })
        expect(await of()).toBeNull()
        await open()
        expect((await of())?.thread.threadId).toBe(100)
        await groups.remove("biz-1")
        expect(await of()).toBeNull()
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

    it("a topic is named «Ism · telefon», else «Ism · @username», else the name", () => {
        const aziz = { firstName: " Aziz ", lastName: "Karimov", username: "aziz" }
        expect(supportTopicName({ ...aziz, phone: "+998901234567" }, "Mijoz")).toBe(
            "Aziz Karimov · 90 123 45 67",
        )
        expect(supportTopicName(aziz, "Mijoz")).toBe("Aziz Karimov · @aziz")
        expect(supportTopicName({ firstName: "Aziz" }, "Mijoz")).toBe("Aziz")
        expect(supportTopicName({ firstName: "" }, "Mijoz")).toBe("Mijoz")
        // The name leaves room for the number: a phone shows about 30 characters of it.
        const long = supportTopicName({ firstName: "😀".repeat(200), phone: "+998901234567" }, "M")
        expect(long).toBe(`${"😀".repeat(20)} · 90 123 45 67`)
        expect(shortPhone("+79161234567")).toBe("+79161234567")
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

    it("the card: their phone only when given to this shop, orders counted, the last one", async () => {
        expect(await context.profile("biz-1", CUSTOMER_TG)).toEqual({ orders: 0, lastOrder: null })
        const orderId = await placeOrder()
        expect(await context.profile("biz-1", CUSTOMER_TG)).toMatchObject({
            phone: "+998901234567",
            orders: 1,
            lastOrder: { orderId, number: 1, status: OrderStatus.PENDING },
        })
        // Another shop knows nothing of them: no phone, no orders.
        expect(await context.profile("biz-2", CUSTOMER_TG)).toEqual({
            orders: 0,
            lastOrder: null,
        })
    })

    it("orders are counted up to 11, never the whole history", async () => {
        for (let i = 0; i < 12; i++) {
            await placeOrder()
        }
        expect((await context.profile("biz-1", CUSTOMER_TG)).orders).toBe(11)
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

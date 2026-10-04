/**
 * The Zumda courier bot: one bot and one screen for a courier of several shops. Order cards come
 * from the courier bot with the shop's name; the courier picks up and delivers from the chat or
 * the app; never sees other orders or kitchen steps.
 */
import { expect, test } from "@playwright/test"

import { APP_URL, WORKER_URL, courierBot, shopBySlug } from "../stand/config.js"
import {
    FOOD,
    PEOPLE,
    WATER,
    apiAs,
    payAndAccept,
    placeOrder,
    resetStand,
} from "../support/stand.js"
import { courierChat, lastSeq, messagesTo, shopChat, waitForMessage } from "../support/telegram.js"
import { openApp, signInitData, openSettings } from "../support/webapp.js"

import type { PlacedOrder } from "../support/stand.js"
import type { TgUser } from "../support/telegram.js"

const COURIER_ID = "dev-food-courier"

async function owner(orderId: string, json: object, path = "", shop = FOOD): Promise<Response> {
    const user = shop === FOOD ? PEOPLE.foodOwner : PEOPLE.waterOwner
    return apiAs(user, `/owner/orders/${orderId}${path}`, {
        shop,
        method: path ? "PUT" : "PATCH",
        json,
    })
}

/** «Деньги пришли, принять»: the shop starts only after the transfer. */
async function accept(orderId: string, shop = FOOD): Promise<Response> {
    return payAndAccept(shop === FOOD ? PEOPLE.foodOwner : PEOPLE.waterOwner, shop, orderId)
}

async function courierApi(
    user: TgUser,
    path: string,
    method = "GET",
    json?: object,
): Promise<Response> {
    return apiAs(user, `/courier${path}`, { courierBot: true, method, json })
}

async function assigned(courierId = COURIER_ID): Promise<PlacedOrder> {
    const order = await placeOrder(
        PEOPLE.customer,
        FOOD,
        [{ productId: "dev-food-p1", quantity: 2 }],
        { landmark: "bozor yonida", location: { latitude: 40.49, longitude: 68.78 } },
    )
    expect((await accept(order.id)).status).toBe(200)
    expect((await owner(order.id, { courierId }, "/courier")).status).toBe(200)
    return order
}

interface Home {
    profile: { onShift: boolean; vehicle?: string }
    shops: { shopName: string; worksToday: boolean }[]
    orders: { id: string; number: number; status: string; shopName: string }[]
}

async function home(user: TgUser): Promise<Home> {
    const response = await courierApi(user, "/home")
    expect(response.status).toBe(200)
    return (await response.json()) as Home
}

/** The owner invites, the person opens the link in the courier bot; returns the courier id. */
async function invite(shop: string, person: TgUser): Promise<string> {
    const ownerUser = shop === FOOD ? PEOPLE.foodOwner : PEOPLE.waterOwner
    const created = (await (
        await apiAs(ownerUser, "/owner/couriers/invites", { shop, method: "POST" })
    ).json()) as { link: string }
    expect(created.link).toContain(`t.me/${courierBot().username}?start=c_`)
    const since = await lastSeq()
    await courierChat().send(person, `/start ${created.link.split("start=")[1] ?? ""}`)
    const ask = await waitForMessage(
        ownerUser.id,
        `${person.first_name} kuryer bo'lish taklifini qabul qildi`,
        since,
    )
    const approve = ask.buttons.find((b) => b.callback_data?.endsWith(":approve"))
    expect(approve?.text).toBe("✅ Tasdiqlash")
    return approve?.callback_data?.split(":")[1] ?? ""
}

async function approve(shop: string, courierId: string): Promise<Response> {
    const ownerUser = shop === FOOD ? PEOPLE.foodOwner : PEOPLE.waterOwner
    return apiAs(ownerUser, `/owner/couriers/${courierId}/review`, {
        shop,
        method: "POST",
        json: { approve: true },
    })
}

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("the card comes from the courier bot with the shop's name; no buttons until ready", async () => {
    const since = await lastSeq()
    const order = await assigned()
    const card = await waitForMessage(PEOPLE.courier.id, `#${order.number}`, since)
    expect(card.token).toBe(courierBot().token)
    expect(card.text).toContain("Osh Markaz")
    expect(card.text).toContain("Navoiy 12")
    expect(card.text).toContain("+998 90 123 45 67")
    // Paid to the shop's card before cooking: nothing to take at the door.
    expect(card.text).toContain("Oldindan to'langan, mijozdan pul olmang")
    expect(card.text).toContain("bozor yonida")
    expect(card.text).toContain("yandex")
    expect(card.buttons.filter((b) => b.callback_data)).toHaveLength(0)
    expect(card.text).toContain("Buyurtma tayyor bo'lganda xabar beramiz")
    expect((await owner(order.id, { status: "preparing" })).status).toBe(200)
    expect((await owner(order.id, { status: "ready" })).status).toBe(200)
    const ping = await waitForMessage(PEOPLE.courier.id, `#${order.number} buyurtma tayyor`, since)
    expect(ping.token).toBe(courierBot().token)
    expect(ping.text).toContain("Osh Markaz")
})

test("ready → «Забрал» in the courier bot → «Доставил» in the app; the customer is told", async ({
    page,
}) => {
    const order = (await home(PEOPLE.courier)).orders.find((o) => o.status === "ready")
    expect(order?.shopName).toBe("Osh Markaz")
    const edited = (await messagesTo(PEOPLE.courier.id))
        .filter((m) => m.method === "editMessageText")
        .at(-1)
    expect(edited?.token).toBe(courierBot().token)
    const picked = edited?.buttons.find((b) => b.callback_data?.endsWith(":picked_up"))
    expect(picked?.text).toBe("🚚 Oldim")

    const since = await lastSeq()
    await courierChat().press(PEOPLE.courier, picked?.callback_data ?? "")
    const told = await waitForMessage(PEOPLE.customer.id, `#${order?.number ?? 0}`, since)
    expect(told.text).toContain("Jasur")
    expect(told.text).not.toContain("+998901112233")
    expect(told.text).not.toContain("+998 90 111 22 33")

    await openApp(page, { user: PEOPLE.courier, courierBot: true })
    await expect(page.getByRole("heading", { name: "Yetkazishlarim" })).toBeVisible()
    await expect(page.getByText("Oldindan to'langan, pul olmang")).toBeVisible()
    const before = await lastSeq()
    // One «Доставил»: the money is already the shop's, nobody asks how it was paid.
    await page.getByRole("button", { name: "Yetkazdim" }).click()
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(page.getByText(/Bugun yetkazilgan · 1/)).toBeVisible()
    await expect(page.getByText(/Qo'lingizda/)).toBeHidden()
    await waitForMessage(PEOPLE.customer.id, "yetkazildi", before)
})

test("the customer sees «Везёт Jasur» while the order is on the way", async ({ page }) => {
    const order = await assigned()
    await owner(order.id, { status: "preparing" })
    await owner(order.id, { status: "ready" })
    expect(
        (await courierApi(PEOPLE.courier, `/orders/${order.id}`, "PATCH", { status: "picked_up" }))
            .status,
    ).toBe(200)
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: "Buyurtmalarim" }).click()
    await page.getByRole("button", { name: new RegExp(`Buyurtma #${order.number}`) }).click()
    await expect(page.getByText("Jasur olib kelmoqda")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Yo'lda" })).toBeVisible()
})

test("a courier moves only own orders and only the delivery part; never cancels", async () => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    await accept(order.id)
    const path = `/orders/${order.id}`
    expect((await courierApi(PEOPLE.courier, path, "PATCH", { status: "picked_up" })).status).toBe(
        403,
    )
    await owner(order.id, { courierId: COURIER_ID }, "/courier")
    expect((await courierApi(PEOPLE.courier, path, "PATCH", { status: "preparing" })).status).toBe(
        400,
    )
    const early = await courierApi(PEOPLE.courier, path, "PATCH", { status: "picked_up" })
    expect([409, 422]).toContain(early.status)
    expect((await courierApi(PEOPLE.courier, path, "PATCH", { status: "cancelled" })).status).toBe(
        400,
    )
    // Inside a shop's app the courier is just a customer.
    expect((await apiAs(PEOPLE.courier, "/owner/orders", { shop: FOOD })).status).toBe(403)
    // The courier bot's signature carries no shop at all: owner routes refuse it.
    const viaCourierBot = await apiAs(PEOPLE.courier, "/owner/orders", { courierBot: true })
    expect(viaCourierBot.status).toBe(400)
    expect(await viaCourierBot.json()).toMatchObject({ error: { code: "SHOP_REQUIRED" } })
})

test("an invite in the courier bot: phone asked, waits for the owner, the owner approves", async ({
    page,
}) => {
    const since = await lastSeq()
    const id = await invite(FOOD, PEOPLE.newCourier)
    const waiting = await waitForMessage(
        PEOPLE.newCourier.id,
        "egasi sizni tasdiqlashini kuting",
        since,
    )
    expect(waiting.token).toBe(courierBot().token)
    expect(waiting.text).toContain("telefon raqamingizni yuboring")
    // A forwarded contact is not theirs; their own one is saved.
    await courierChat().shareContact(PEOPLE.newCourier, "+998907776655", PEOPLE.stranger.id)
    await courierChat().shareContact(PEOPLE.newCourier, "+998907776655")
    await waitForMessage(PEOPLE.newCourier.id, /raqamingiz/i, since)

    // Not approved yet: cannot get an order, sees no deliveries.
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    await accept(order.id)
    const early = await owner(order.id, { courierId: id }, "/courier")
    expect(early.status).toBe(422)
    expect(
        ((await early.json()) as { error: { details: { reason: string } } }).error.details,
    ).toMatchObject({ reason: "not_approved" })
    expect((await courierApi(PEOPLE.newCourier, "/home")).status).toBe(403)
    // The app says the same as the bot: wait for the owner, no new link needed.
    await openApp(page, { user: PEOPLE.newCourier, courierBot: true })
    await expect(page.getByText("Siz hali kuryer emassiz")).toBeVisible()
    await expect(page.getByText(/Havolani ochgan bo'lsangiz, tasdiqlashni kuting/)).toBeVisible()

    // The owner presses «Подтвердить» in the shop bot.
    const ask = (await messagesTo(PEOPLE.foodOwner.id, since)).findLast((m) =>
        m.text.includes("Bobur"),
    )
    const before = await lastSeq()
    await shopChat(FOOD).press(PEOPLE.foodOwner, ask?.buttons[0]?.callback_data ?? "", 1)
    const welcome = await waitForMessage(
        PEOPLE.newCourier.id,
        "sizni kuryer sifatida tasdiqladi",
        before,
    )
    expect(welcome.buttons[0]?.web_app?.url).toBe("http://localhost:5173/?mode=courier")
    await waitForMessage(PEOPLE.foodOwner.id, "Bobur endi sizning kuryeringiz", before)
    // The same button twice is a no-op with a clear answer, never a second approval.
    expect((await approve(FOOD, id)).status).toBe(409)

    const couriers = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/couriers", { shop: FOOD })
    ).json()) as { id: string; phone?: string; status: string }[]
    expect(couriers.find((c) => c.id === id)).toMatchObject({
        status: "active",
        phone: "+998907776655",
    })
})

test("one person, two shops: both orders in one screen, owners see only theirs", async ({
    page,
}) => {
    // Bobur is already Osh Markaz's courier; Toza Suv invites him too.
    const waterId = await invite(WATER, PEOPLE.newCourier)
    expect((await approve(WATER, waterId)).status).toBe(200)
    expect((await courierApi(PEOPLE.newCourier, "/shift", "PUT", { onShift: true })).status).toBe(
        200,
    )

    const food = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    const water = await placeOrder(PEOPLE.customer, WATER, [
        { productId: "dev-water-p1", quantity: 1 },
    ])
    const foodLink = (
        (await (await apiAs(PEOPLE.foodOwner, "/owner/couriers", { shop: FOOD })).json()) as {
            id: string
            name: string
        }[]
    ).find((c) => c.name === "Bobur")
    for (const [order, shop, id] of [
        [food, FOOD, foodLink?.id ?? ""],
        [water, WATER, waterId],
    ] as const) {
        expect((await accept(order.id, shop)).status).toBe(200)
        expect((await owner(order.id, { courierId: id }, "/courier", shop)).status).toBe(200)
        await owner(order.id, { status: "preparing" }, "", shop)
        await owner(order.id, { status: "ready" }, "", shop)
    }

    const screen = await home(PEOPLE.newCourier)
    expect(screen.shops.map((s) => s.shopName).sort()).toEqual(["Osh Markaz", "Toza Suv"])
    expect(screen.orders.map((o) => o.shopName).sort()).toEqual(["Osh Markaz", "Toza Suv"])

    // Delivers both: paid in advance, nothing to collect at either door.
    for (const order of [food, water]) {
        const path = `/orders/${order.id}`
        await courierApi(PEOPLE.newCourier, path, "PATCH", { status: "picked_up" })
        const done = await courierApi(PEOPLE.newCourier, path, "PATCH", { status: "delivered" })
        expect(done.status).toBe(200)
    }

    // Each owner sees only their own couriers and money.
    const waterCouriers = (await (
        await apiAs(PEOPLE.waterOwner, "/owner/couriers", { shop: WATER })
    ).json()) as { id: string }[]
    expect(waterCouriers.map((c) => c.id)).toContain(waterId)
    expect(waterCouriers.map((c) => c.id)).not.toContain(foodLink?.id)
    const report = (await (
        await apiAs(PEOPLE.waterOwner, "/owner/money", { shop: WATER })
    ).json()) as { totals: { delivered: number; paid: number } }
    expect(report.totals).toMatchObject({ delivered: 1, paid: water.total })

    await openApp(page, { user: PEOPLE.newCourier, courierBot: true })
    await expect(page.getByText(/Bugun yetkazilgan · 2/)).toBeVisible()
    await expect(page.getByText("Osh Markaz").first()).toBeVisible()
    await expect(page.getByText("Toza Suv").first()).toBeVisible()
})

test("days and shift: «сегодня не работает» and «не на смене» keep orders away", async ({
    page,
}) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    await accept(order.id)
    const reasonOf = async (response: Response): Promise<string> => {
        expect(response.status).toBe(422)
        const body = (await response.json()) as {
            error: { code: string; details: { reason: string } }
        }
        expect(body.error.code).toBe("COURIER_NOT_AVAILABLE")
        return body.error.details.reason
    }

    // The owner switches the courier off for today in "Мой магазин".
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await openSettings(page, "Kuryerlar")
    const row = page.getByRole("listitem").filter({ hasText: "Jasur" })
    // «Bugun ishlaydi» is on while the courier works today, like «Sotuvda» in the menu.
    const today = row.getByRole("switch", { name: /Bugun ishlaydi/ })
    await expect(today).toHaveAttribute("aria-checked", "true")
    await today.click()
    await expect(today).toHaveAttribute("aria-checked", "false")
    await expect(row).toContainText("Bugun ishlamaydi")
    expect(await reasonOf(await owner(order.id, { courierId: COURIER_ID }, "/courier"))).toBe(
        "off_today",
    )
    await today.click()
    await expect(today).toHaveAttribute("aria-checked", "true")

    // The courier ends the shift in the courier app.
    const courierPage = await page.context().newPage()
    await openApp(courierPage, { user: PEOPLE.courier, courierBot: true })
    const shift = courierPage.getByRole("switch", { name: "Smenadaman" })
    await expect(shift).toHaveAttribute("aria-checked", "true")
    await shift.click()
    await expect(shift).toHaveAttribute("aria-checked", "false")
    expect(await reasonOf(await owner(order.id, { courierId: COURIER_ID }, "/courier"))).toBe(
        "not_on_shift",
    )

    // In the order the owner sees why, and cannot pick them.
    await page.getByRole("tab", { name: "Buyurtmalar" }).click()
    await page.getByRole("button", { name: "Kuryer tayinlash" }).first().click()
    const option = page.getByRole("dialog").getByRole("button", { name: /Jasur/ })
    await expect(option).toContainText("smenada emas")
    await expect(option).toBeDisabled()

    // Back on shift: the order goes to them.
    await shift.click()
    await expect(shift).toHaveAttribute("aria-checked", "true")
    expect((await owner(order.id, { courierId: COURIER_ID }, "/courier")).status).toBe(200)
})

test("a courier on shift switched off for today by mistake is still one tap away", async ({
    page,
}) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    await accept(order.id)
    const off = await apiAs(PEOPLE.foodOwner, `/owner/couriers/${COURIER_ID}`, {
        shop: FOOD,
        method: "PATCH",
        json: { offToday: true },
    })
    expect(off.status).toBe(200)

    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    const card = page
        .locator("li")
        .filter({ has: page.getByText(`Buyurtma #${order.number}`, { exact: true }) })
    await card.getByRole("button", { name: "Kuryer tayinlash" }).click()
    const option = page.getByRole("dialog").getByRole("button", { name: /Jasur/ })
    await expect(option).toContainText("bugunga qaytariladi")
    await expect(option).toBeEnabled()
    await option.click()
    await expect(card).toContainText("Jasur")

    const couriers = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/couriers", { shop: FOOD })
    ).json()) as { id: string; offToday: boolean }[]
    expect(couriers.find((courier) => courier.id === COURIER_ID)?.offToday).toBe(false)
})

test("reassigning tells the previous courier in the courier bot; the order leaves their list", async () => {
    const couriers = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/couriers", { shop: FOOD })
    ).json()) as { id: string; name: string }[]
    const bobur = couriers.find((c) => c.name === "Bobur")

    const order = await assigned()
    const since = await lastSeq()
    expect((await owner(order.id, { courierId: bobur?.id }, "/courier")).status).toBe(200)
    const gone = await waitForMessage(
        PEOPLE.courier.id,
        `#${order.number} buyurtma boshqa kuryerga berildi`,
        since,
    )
    expect(gone.token).toBe(courierBot().token)
    await waitForMessage(PEOPLE.newCourier.id, `#${order.number}`, since)
    expect((await home(PEOPLE.courier)).orders.map((o) => o.id)).not.toContain(order.id)
})

test("the courier bot's /start: shops and the button; a stranger is asked for an invite", async ({
    page,
}) => {
    const since = await lastSeq()
    await courierChat().send(PEOPLE.courier, "/start")
    const greeting = await waitForMessage(PEOPLE.courier.id, "Siz kuryersiz", since)
    expect(greeting.photo).toBe("http://localhost:5173/welcome/kuryer.jpg")
    expect(greeting.text).toContain("Osh Markaz")
    expect(greeting.text).toContain("Toza Suv")
    expect(greeting.buttons.map((b) => b.web_app?.url)).toEqual([
        "http://localhost:5173/?mode=courier",
    ])

    await courierChat().send(PEOPLE.stranger, "/start")
    await waitForMessage(PEOPLE.stranger.id, "biznes egasidan taklif havolasini so'rang", since)

    await openApp(page, { user: PEOPLE.stranger, courierBot: true })
    await expect(page.getByText("Siz hali kuryer emassiz")).toBeVisible()
})

test("a courier invite opened in a shop bot joins nobody; a forged courier signature is refused", async () => {
    const created = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/couriers/invites", { shop: FOOD, method: "POST" })
    ).json()) as { link: string }
    await shopChat(FOOD).send(PEOPLE.stranger, `/start ${created.link.split("start=")[1] ?? ""}`)
    const couriers = (await (
        await apiAs(PEOPLE.foodOwner, "/owner/couriers", { shop: FOOD })
    ).json()) as { name: string }[]
    expect(couriers.map((c) => c.name)).not.toContain(PEOPLE.stranger.first_name)

    // initData signed by a shop bot but sent as the courier bot: the signature does not match.
    const forged = await fetch(`${WORKER_URL}/api/courier/home`, {
        headers: {
            "X-Bot": "courier",
            Origin: APP_URL,
            "X-Telegram-Init-Data": signInitData(PEOPLE.courier, shopBySlug(FOOD).bot.token),
        },
    })
    expect(forged.status).toBe(401)
})

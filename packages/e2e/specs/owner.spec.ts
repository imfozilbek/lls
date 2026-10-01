/**
 * The shop owner: orders from the bot chat and from "Мой магазин", catalog with photos,
 * stop-list, stats, settings, couriers.
 */
import { expect, test } from "@playwright/test"

import { pngImage } from "../support/images.js"
import { FOOD, PEOPLE, WATER, apiAs, placeOrder, resetStand } from "../support/stand.js"
import { lastSeq, messagesTo, shopChat, waitForMessage } from "../support/telegram.js"
import { bottomButton, openApp } from "../support/webapp.js"

import type { OpenedApp } from "../support/webapp.js"
import type { Page } from "@playwright/test"

async function openOwner(page: Page, options: { native?: boolean } = {}): Promise<OpenedApp> {
    const app = await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD, ...options })
    await page.getByRole("button", { name: "Мой магазин" }).click()
    await expect(page.getByRole("tab", { name: "Заказы" })).toBeVisible()
    return app
}

const card = (page: Page, number: number): ReturnType<Page["locator"]> =>
    page.locator("li").filter({ has: page.getByText(`Заказ #${number}`, { exact: true }) })

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

test("only the owner sees «Мой магазин»; an owner in another shop is a customer there", async ({
    page,
}) => {
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Мой магазин" })).toBeHidden()
    expect((await apiAs(PEOPLE.customer, "/owner/orders", { shop: FOOD })).status).toBe(403)

    await openApp(page, { user: PEOPLE.foodOwner, shop: WATER })
    await expect(page.getByRole("heading", { name: "Toza Suv", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Мой магазин" })).toBeHidden()
})

test("empty orders, then a new order: card, every step from the app, customer told", async ({
    page,
}) => {
    await openOwner(page)
    await expect(page.getByText("Активных заказов нет")).toBeVisible()

    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    await page.getByRole("tab", { name: "Завершённые" }).click()
    await page.getByRole("tab", { name: "Активные" }).click()
    const one = card(page, order.number)
    await expect(one).toContainText("To'y oshi")
    await expect(one).toContainText("Aziz Karimov")

    const steps: [string, string][] = [
        ["Принять", "принят"],
        ["Начать готовить", "готовится"],
        ["Готово", "готов"],
        ["Отправить", "в пути"],
        ["Доставлен", "доставлен"],
    ]
    for (const [button, told] of steps) {
        const since = await lastSeq()
        await one.getByRole("button", { name: button, exact: true }).click()
        await waitForMessage(PEOPLE.customer.id, told, since)
    }
    await expect(one.getByRole("button", { name: "Отменить" })).toBeHidden()
    await page.getByRole("tab", { name: "Завершённые" }).click()
    await expect(card(page, order.number)).toBeVisible()
})

test("cancel with a reason: the customer sees the reason", async ({ page }) => {
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    await openOwner(page)
    const since = await lastSeq()
    await card(page, order.number).getByRole("button", { name: "Отменить" }).click()
    await page.getByLabel("Причина (необязательно)").fill("Плов закончился")
    await page.getByRole("dialog").getByRole("button", { name: "Отменить", exact: true }).click()
    await expect(card(page, order.number)).toContainText("Отменён")
    await waitForMessage(PEOPLE.customer.id, "отменён", since)

    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await page.getByRole("button", { name: "Мои заказы" }).click()
    await page.getByRole("button", { name: new RegExp(`Заказ #${order.number}`) }).click()
    await expect(page.getByText("Плов закончился")).toBeVisible()
})

test("bot chat buttons: the owner moves the order; old buttons and strangers are refused", async () => {
    const since = await lastSeq()
    const order = await placeOrder(PEOPLE.customer, FOOD, [
        { productId: "dev-food-p1", quantity: 1 },
    ])
    const newCard = await waitForMessage(PEOPLE.foodOwner.id, `#${order.number}`, since)
    const accept = newCard.buttons.find((b) => b.callback_data?.endsWith(":accepted"))
    expect(accept?.text).toBe("✅ Принять")

    // A stranger who got the button data cannot press it.
    await shopChat(FOOD).press(PEOPLE.stranger, accept?.callback_data ?? "")
    const order1 = await apiAs(PEOPLE.customer, `/orders/${order.id}`, { shop: FOOD })
    expect(((await order1.json()) as { status: string }).status).toBe("pending")

    await shopChat(FOOD).press(PEOPLE.foodOwner, accept?.callback_data ?? "")
    // The card is edited in place with the next step.
    await expect
        .poll(async () =>
            (await messagesTo(PEOPLE.foodOwner.id, since))
                .filter((m) => m.method === "editMessageText")
                .at(-1)
                ?.buttons.map((b) => b.text),
        )
        .toContain("👨‍🍳 Начать готовить")
    // The old "accept" button again: nothing changes.
    await shopChat(FOOD).press(PEOPLE.foodOwner, accept?.callback_data ?? "")
    const after = await apiAs(PEOPLE.customer, `/orders/${order.id}`, { shop: FOOD })
    expect(((await after.json()) as { status: string }).status).toBe("accepted")

    // Cancel from the chat.
    const cancel = newCard.buttons.find((b) => b.callback_data?.startsWith("x:"))
    const before = await lastSeq()
    await shopChat(FOOD).press(PEOPLE.foodOwner, cancel?.callback_data ?? "")
    await waitForMessage(PEOPLE.customer.id, "отменён", before)
})

test("catalog: add a product with a photo; customers see it at once", async ({ page }) => {
    await openOwner(page)
    await page.getByRole("tab", { name: "Меню" }).click()
    await expect(page.getByText("To'y oshi")).toBeVisible()
    await bottomButton(page).click() // «Добавить товар»
    await expect(page.getByRole("heading", { name: "Новый товар" })).toBeVisible()
    await expect(bottomButton(page)).toBeDisabled()

    await page.locator('input[type="file"]').setInputFiles({
        name: "manti.png",
        mimeType: "image/png",
        buffer: pngImage(400),
    })
    await expect(page.getByRole("button", { name: "Заменить" })).toBeVisible()
    await page.getByLabel("Название").fill("Manti")
    await page.getByLabel("Цена").fill("30000")
    await expect(page.getByLabel("Цена")).toHaveValue("30 000")
    await page.getByRole("button", { name: "Блюда", exact: true }).click()
    await page.getByLabel("Описание").fill("5 штук, с тыквой")
    await bottomButton(page).click()
    await expect(page.getByText("Сохранено")).toBeVisible()
    await expect(page.getByText("Manti")).toBeVisible()

    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    const tile = page.locator("article").filter({ hasText: "Manti" })
    await expect(tile).toContainText("5 штук, с тыквой")
    await expect(tile.locator("img")).toHaveAttribute("src", /\/img\//)
    // The photo is served, as WebP or the original type.
    const src = await tile.locator("img").getAttribute("src")
    const image = await page.request.get(src ?? "")
    expect(image.status()).toBe(200)
    expect(image.headers()["x-content-type-options"]).toBe("nosniff")
})

test("catalog: edit price, take off for today, hide, show again, delete", async ({ page }) => {
    await openOwner(page)
    await page.getByRole("tab", { name: "Меню" }).click()
    await page.getByRole("button", { name: /Manti/ }).click()
    await expect(page.getByRole("heading", { name: "Товар" })).toBeVisible()
    await page.getByLabel("Цена").fill("32000")
    await bottomButton(page).click()
    await expect(page.getByText(/32\s000/)).toBeVisible()

    await page.getByRole("switch", { name: "В наличии: Manti" }).click()
    // The sheet sits at the bottom of the screen, over everything (not inside the list row).
    const sheet = page.getByRole("dialog")
    const box = await sheet.getByRole("heading", { name: "Убрать из продажи" }).boundingBox()
    const height = page.viewportSize()?.height ?? 0
    expect(box?.y ?? 0).toBeGreaterThan(height / 2)
    // The switch ignores taps while a save is on its way: wait for each save, as a person would.
    const saved = (): Promise<unknown> =>
        page.waitForResponse(
            (r) => r.url().includes("/owner/products/") && r.request().method() === "PATCH",
        )
    await Promise.all([saved(), page.getByRole("button", { name: /Только на сегодня/ }).click()])
    await expect(page.getByText("Сегодня нет")).toBeVisible()
    await Promise.all([saved(), page.getByRole("switch", { name: "В наличии: Manti" }).click()])
    await expect(page.getByRole("switch", { name: "В наличии: Manti" })).toHaveAttribute(
        "aria-checked",
        "true",
    )
    await page.getByRole("switch", { name: "В наличии: Manti" }).click()
    await Promise.all([saved(), page.getByRole("button", { name: "Скрыть совсем" }).click()])
    await expect(page.getByText("Скрыто")).toBeVisible()

    const catalog = (await (
        await apiAs(PEOPLE.customer, "/shop/products", { shop: FOOD })
    ).json()) as {
        data: { name: string }[]
    }
    expect(catalog.data.map((p) => p.name)).not.toContain("Manti")

    await page.getByRole("button", { name: /Manti/ }).click()
    await page.getByRole("button", { name: "Удалить" }).click()
    await expect(page.getByRole("tab", { name: "Меню" })).toBeVisible()
    await expect(page.getByText("Manti")).toBeHidden()
})

test("catalog in Telegram's native button: «Добавить товар» opens the editor", async ({ page }) => {
    const app = await openOwner(page, { native: true })
    await page.getByRole("tab", { name: "Меню" }).click()
    await expect.poll(async () => (await app.mainButton())["text"]).toBe("Добавить товар")
    await expect(bottomButton(page)).toHaveCount(0)
    await app.pressMainButton()
    await expect(page.getByRole("heading", { name: "Новый товар" })).toBeVisible()
    await app.back()
    await expect(page.getByRole("tab", { name: "Меню" })).toBeVisible()
})

test("stats count today's orders and revenue", async ({ page }) => {
    await openOwner(page)
    await page.getByRole("tab", { name: "Статистика" }).click()
    await expect(page.getByText("Сегодня")).toBeVisible()
    await expect(page.getByText("Выручка").first()).toBeVisible()
    // One delivered order for 55 000 earlier in this file.
    await expect(page.getByText(/55\s000/).first()).toBeVisible()
})

test("settings: name, color, delivery and features reach the storefront", async ({ page }) => {
    await openOwner(page)
    await page.getByRole("tab", { name: "Настройки" }).click()
    await expect(
        page.getByText("Ваш магазин в поиске бота LLS. Комиссия с продаж через витрину: 5%."),
    ).toBeVisible()
    await expect(page.getByText("https://t.me/osh_markaz_dev_bot")).toBeVisible()
    await page.getByLabel("Название", { exact: true }).fill("Osh Markaz Guliston")
    await page.getByRole("radio").nth(2).click()
    await page.getByLabel("Стоимость доставки").fill("12000")
    await page.getByRole("switch", { name: "Повтор заказа" }).click()
    await bottomButton(page).click()
    await expect(page.getByText("Сохранено")).toBeVisible()

    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByRole("heading", { name: "Osh Markaz Guliston" })).toBeVisible()
    await expect(page.getByText(/Доставка 12\s000/)).toBeVisible()
    // Reorder is off: no "Повторить" in history.
    await page.getByRole("button", { name: "Мои заказы" }).click()
    await expect(page.getByRole("button", { name: /Заказ #1/ })).toBeVisible()
    await expect(page.getByRole("button", { name: "Повторить" })).toHaveCount(0)
})

test("settings: logo upload and the accepting switch", async ({ page }) => {
    await openOwner(page)
    await page.getByRole("tab", { name: "Настройки" }).click()
    await page
        .locator('input[type="file"]')
        .first()
        .setInputFiles({
            name: "logo.png",
            mimeType: "image/png",
            buffer: pngImage(300, [2, 132, 199]),
        })
    await expect(page.locator("img").first()).toHaveAttribute("src", /\/img\//)
    // The switch moves at once; the check below needs the save to land first.
    await Promise.all([
        page.waitForResponse(
            (r) => r.url().endsWith("/owner/shop") && r.request().method() === "PATCH",
        ),
        page.getByRole("switch", { name: "Принимать заказы" }).click(),
    ])
    await expect(page.getByRole("switch", { name: "Принимать заказы" })).toHaveAttribute(
        "aria-checked",
        "false",
    )
    const shop = (await (await apiAs(PEOPLE.customer, "/shop", { shop: FOOD })).json()) as {
        acceptingOrders: boolean
        logoKey?: string
    }
    expect(shop.acceptingOrders).toBe(false)
    expect(shop.logoKey).toBeTruthy()
    await page.getByRole("switch", { name: "Принимать заказы" }).click()
})

test("couriers: invite link shared in Telegram, the courier joins, the owner removes", async ({
    page,
}) => {
    const app = await openOwner(page)
    await page.getByRole("tab", { name: "Настройки" }).click()
    await expect(page.getByText("Jasur")).toBeVisible()
    await page.getByRole("button", { name: "Пригласить доставщика" }).click()
    await page.getByRole("button", { name: "Отправить в Telegram" }).click()
    const shared = (await app.calls()).find((c) => c.method === "openTelegramLink")
    const shareUrl = new URL(String(shared?.args[0]))
    const link = shareUrl.searchParams.get("url") ?? ""
    expect(link).toMatch(/^https:\/\/t\.me\/osh_markaz_dev_bot\?start=c_[\w-]{16}$/)
    expect(shareUrl.searchParams.get("text")).toContain("Чтобы стать доставщиком")

    const since = await lastSeq()
    await shopChat(FOOD).send(PEOPLE.newCourier, `/start ${link.split("start=")[1] ?? ""}`)
    const welcome = await waitForMessage(PEOPLE.newCourier.id, "Osh Markaz", since)
    expect(welcome.buttons[0]?.web_app?.url).toContain("mode=courier")
    await waitForMessage(PEOPLE.foodOwner.id, "Новый доставщик: Bobur", since)

    // The same link does not work twice.
    await shopChat(FOOD).send(PEOPLE.stranger, `/start ${link.split("start=")[1] ?? ""}`)
    await waitForMessage(PEOPLE.stranger.id, /не работает|ishlamaydi/, since)

    await page.reload()
    await page.getByRole("button", { name: "Мой магазин" }).click()
    await page.getByRole("tab", { name: "Настройки" }).click()
    await expect(page.getByText("Bobur")).toBeVisible()
    await page.getByRole("button", { name: "Удалить: Bobur" }).click()
    await expect(page.getByText("Bobur")).toBeHidden()
    expect((await apiAs(PEOPLE.newCourier, "/courier/orders", { shop: FOOD })).status).toBe(403)
})

test("water shop settings: bottle deposit and returnable bottles", async ({ page }) => {
    await openApp(page, { user: PEOPLE.waterOwner, shop: WATER })
    await page.getByRole("button", { name: "Мой магазин" }).click()
    await page.getByRole("tab", { name: "Настройки" }).click()
    await expect(
        page.getByText("Вашего магазина нет в витрине LLS.", { exact: false }),
    ).toBeVisible()
    await page.getByLabel("Залог за одну бутыль").fill("35000")
    await bottomButton(page).click()
    await expect(page.getByText("Сохранено")).toBeVisible()
    const shop = (await (await apiAs(PEOPLE.customer, "/shop", { shop: WATER })).json()) as {
        bottleDeposit: number
    }
    expect(shop.bottleDeposit).toBe(35_000)

    await page.getByRole("tab", { name: "Каталог" }).click()
    await page.getByRole("button", { name: /Toza suv 19 l/ }).click()
    await expect(page.getByRole("switch", { name: "Возвратная бутыль" })).toHaveAttribute(
        "aria-checked",
        "true",
    )
})

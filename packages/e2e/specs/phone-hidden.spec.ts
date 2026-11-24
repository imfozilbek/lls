/**
 * «Raqamni mijozlarga ko'rsatmaslik» (owner's decision, November 2026; goal 24): the shop keeps its
 * number from customers while its support group answers them; customers write with «Savolim bor»
 * instead of calling, couriers still see the number; the group gone, the number shows by itself.
 */
import { expect, test } from "@playwright/test"

import { FOOD, PEOPLE, resetStand } from "../support/stand.js"
import { groupMembership } from "../support/telegram.js"
import { openApp, openSettings } from "../support/webapp.js"

import type { TgGroup } from "../support/telegram.js"
import type { Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })
test.beforeAll(resetStand)

const GROUP: TgGroup = { id: -1005550077, title: "Osh Markaz savollar", isForum: true }
const SWITCH = "Raqamni mijozlarga ko'rsatmaslik"

async function shopSettings(page: Page): Promise<void> {
    await openApp(page, { user: PEOPLE.foodOwner, shop: FOOD })
    await page.getByRole("button", { name: "Mening do'konim" }).click()
    await openSettings(page, "Do'kon")
}

test("without the support group the switch says to connect it first", async ({ page }) => {
    await shopSettings(page)
    const toggle = page.getByRole("switch", { name: SWITCH })
    const reason = page.getByText("Avval mijozlar savollari guruhini bog'lang.")
    // Never a dead switch: the reason stands next to it, and a tap says it again.
    await expect(reason).toHaveCount(1)
    await toggle.click()
    await expect(reason).toHaveCount(2)
    await expect(toggle).toHaveAttribute("aria-checked", "false")
})

test("with the group the number leaves the customer's screens; «Savolim bor» stays", async ({
    page,
}) => {
    await groupMembership(FOOD, PEOPLE.foodOwner, GROUP, "administrator")
    await shopSettings(page)
    await page.getByRole("switch", { name: SWITCH }).click()
    await expect(page.getByText("Saqlandi")).toBeVisible()
    await expect(page.getByRole("switch", { name: SWITCH })).toHaveAttribute("aria-checked", "true")

    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByRole("heading", { name: "Osh Markaz" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Savolim bor" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Qo'ng'iroq" })).toHaveCount(0)
})

test("the group gone, customers can call again without a touch of the switch", async ({ page }) => {
    await groupMembership(FOOD, PEOPLE.foodOwner, GROUP, "left")
    await openApp(page, { user: PEOPLE.customer, shop: FOOD })
    await expect(page.getByRole("link", { name: "Qo'ng'iroq" })).toHaveAttribute(
        "href",
        "tel:+998901234501",
    )
    await expect(page.getByRole("button", { name: "Savolim bor" })).toHaveCount(0)
})

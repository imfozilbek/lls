/** Test data and direct API access for the stand. */
import { WORKER_URL, platformBot, shopBySlug } from "../stand/config.js"
import { seed } from "../stand/seed.js"

import { resetTelegram, shopChat } from "./telegram.js"
import { signInitData } from "./webapp.js"

import type { TgUser } from "./telegram.js"

export const FOOD = "osh-markaz-dev"
export const WATER = "toza-suv-dev"
export const GROCERY = "baraka-market-dev"

/** People of the stand. Owners and the courier come from the seed (same Telegram ids). */
export const PEOPLE = {
    customer: { id: 2002, first_name: "Aziz", last_name: "Karimov", language_code: "ru" },
    customerUz: { id: 2003, first_name: "Malika", language_code: "uz" },
    stranger: { id: 2009, first_name: "Begona", language_code: "ru" },
    foodOwner: { id: 1001, first_name: "Rustam", language_code: "ru" },
    waterOwner: { id: 1002, first_name: "Dilshod", language_code: "ru" },
    groceryOwner: { id: 1003, first_name: "Nodira", language_code: "ru" },
    courier: { id: 3003, first_name: "Jasur", language_code: "ru" },
    newCourier: { id: 3004, first_name: "Bobur", language_code: "ru" },
    newOwner: { id: 4004, first_name: "Sardor", language_code: "ru" },
    admin: { id: 9999, first_name: "Admin", language_code: "ru" },
} satisfies Record<string, TgUser>

/**
 * Fresh demo data and an empty Telegram log. Owners and the courier read Russian, so bot texts
 * in the specs are readable; Uzbek is checked on its own.
 */
export async function resetStand(): Promise<void> {
    seed()
    await resetTelegram()
    const staff: [TgUser, string | undefined][] = [
        [PEOPLE.admin, undefined],
        [PEOPLE.foodOwner, FOOD],
        [PEOPLE.waterOwner, WATER],
        [PEOPLE.groceryOwner, GROCERY],
        [PEOPLE.courier, FOOD],
    ]
    for (const [user, shop] of staff) {
        const response = await apiAs(user, "/me", {
            shop,
            method: "PATCH",
            json: { language: "ru" },
        })
        if (!response.ok) {
            throw new Error(`Cannot set the language of ${user.first_name}: ${response.status}`)
        }
    }
}

/** Calls the Worker API as `user` inside the app opened from a shop bot (or the LLS bot). */
export async function apiAs(
    user: TgUser,
    path: string,
    options: { shop?: string; via?: "marketplace"; method?: string; json?: unknown } = {},
): Promise<Response> {
    const shop = options.shop && !options.via ? shopBySlug(options.shop) : null
    const token = shop?.bot.token ?? platformBot().token
    const headers: Record<string, string> = {
        "X-Telegram-Init-Data": signInitData(user, token),
        Origin: "http://localhost:5173",
    }
    if (options.shop) {
        headers["X-Shop"] = options.shop
    }
    if (options.via) {
        headers["X-Via"] = options.via
    }
    if (options.json !== undefined) {
        headers["Content-Type"] = "application/json"
    }
    return fetch(`${WORKER_URL}/api${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.json === undefined ? undefined : JSON.stringify(options.json),
    })
}

export interface PlacedOrder {
    id: string
    number: number
    status: string
    total: number
    channel: string
    commission: number
}

/**
 * A customer orders through the API (the UI path is covered in customer-shop.spec.ts):
 * the phone goes to the bot first, as Telegram would send it.
 */
export async function placeOrder(
    customer: TgUser,
    shop: string,
    items: { productId: string; quantity: number }[],
    extra: Record<string, unknown> = {},
): Promise<PlacedOrder> {
    await shopChat(shop).shareContact(customer, "+998901234567")
    const response = await apiAs(customer, "/orders", {
        shop,
        method: "POST",
        json: { items, address: "Navoiy 12", ...extra },
    })
    if (response.status !== 201) {
        throw new Error(`Order failed: ${response.status} ${await response.text()}`)
    }
    return (await response.json()) as PlacedOrder
}

/** Test data and direct API access for the stand. */
import { WORKER_URL, courierBot, platformBot, shopBySlug } from "../stand/config.js"
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
    /** District network couriers from the seed: Otabek (water shop), Sherzod (grocery). */
    networkCourier: { id: 3005, first_name: "Otabek", language_code: "ru" },
    networkCourier2: { id: 3006, first_name: "Sherzod", language_code: "ru" },
    newOwner: { id: 4004, first_name: "Sardor", language_code: "ru" },
    admin: { id: 9999, first_name: "Admin", language_code: "ru" },
} satisfies Record<string, TgUser>

/**
 * Fresh demo data and an empty Telegram log. Everyone's Telegram is in Russian on purpose: the
 * product still speaks Uzbek only (owner's decision), and every spec checks Uzbek texts.
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
        [PEOPLE.networkCourier, FOOD],
        [PEOPLE.networkCourier2, FOOD],
    ]
    for (const [user, shop] of staff) {
        const response = await apiAs(user, "/me", {
            shop,
            method: "PATCH",
            json: { language: "uz" },
        })
        if (!response.ok) {
            throw new Error(`Cannot set the language of ${user.first_name}: ${response.status}`)
        }
    }
}

export interface ApiOptions {
    shop?: string
    via?: "marketplace"
    /** Inside the app opened from the LLS courier bot (no shop). */
    courierBot?: boolean
    method?: string
    json?: unknown
}

/**
 * Calls the Worker API as `user` inside the app opened from a shop bot, the LLS bot or the
 * LLS courier bot.
 */
export async function apiAs(
    user: TgUser,
    path: string,
    options: ApiOptions = {},
): Promise<Response> {
    const shop = options.shop && !options.via ? shopBySlug(options.shop) : null
    const token = options.courierBot ? courierBot().token : (shop?.bot.token ?? platformBot().token)
    const headers: Record<string, string> = {
        "X-Telegram-Init-Data": signInitData(user, token),
        Origin: "http://localhost:5173",
    }
    if (options.courierBot) {
        headers["X-Bot"] = "courier"
    } else if (options.shop) {
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

/**
 * «Деньги пришли — принять»: the owner of `shop` saw the transfer on the card. The order is paid
 * and accepted in one step (the shop starts only after the money).
 */
export async function payAndAccept(
    owner: TgUser,
    shop: string,
    orderId: string,
): Promise<Response> {
    return apiAs(owner, `/owner/orders/${orderId}/payment`, {
        shop,
        method: "PATCH",
        json: { action: "paid" },
    })
}

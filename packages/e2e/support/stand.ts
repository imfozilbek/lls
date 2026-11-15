/** Test data and direct API access for the stand. */
import { createHash } from "node:crypto"

import {
    WORKER_URL,
    adminBot,
    businessBot,
    courierBot,
    platformBot,
    shopBySlug,
} from "../stand/config.js"
import { seed } from "../stand/seed.js"

import { fetchOnce } from "./fetch-once.js"
import { pngImage } from "./images.js"
import { resetTelegram, shopChat } from "./telegram.js"
import { signInitData } from "./webapp.js"

import type { TgUser } from "./telegram.js"
import type { DevShop } from "../stand/config.js"

export const FOOD = "osh-markaz-dev"
export const WATER = "toza-suv-dev"
export const GROCERY = "baraka-market-dev"
/** A service business (carpet and car cleaning) of the seed. */
export const SERVICE = "toza-gilam-dev"
/** A shop of goods that are not food («Do'kon (mollar)»), taking both a card and cash. */
export const STORE = "uy-bozori-dev"

/** People of the stand. Owners and the courier come from the seed (same Telegram ids). */
export const PEOPLE = {
    customer: { id: 2002, first_name: "Aziz", last_name: "Karimov", language_code: "ru" },
    customerUz: { id: 2003, first_name: "Malika", language_code: "uz" },
    stranger: { id: 2009, first_name: "Begona", language_code: "ru" },
    foodOwner: { id: 1001, first_name: "Rustam", language_code: "ru" },
    waterOwner: { id: 1002, first_name: "Dilshod", language_code: "ru" },
    groceryOwner: { id: 1003, first_name: "Nodira", language_code: "ru" },
    serviceOwner: { id: 1004, first_name: "Jasur", language_code: "ru" },
    storeOwner: { id: 1005, first_name: "Feruza", language_code: "ru" },
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
        [PEOPLE.serviceOwner, SERVICE],
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
    /** Inside the app opened from the Zumda courier bot (no shop). */
    courierBot?: boolean
    /** Inside the app opened from Zumda Business («Mening bizneslarim», an owner's shop). */
    businessBot?: boolean
    /** Inside «Platforma», opened from Zumda | Platforma (no shop). */
    adminBot?: boolean
    method?: string
    json?: unknown
    /** A PNG body instead of JSON (the transfer screenshot). */
    png?: Buffer
}

/** The bot whose token signs: the courier bot, Zumda Business, the shop's own bot or the Zumda bot. */
function signerToken(options: ApiOptions, shop: DevShop | null): string {
    if (options.courierBot) {
        return courierBot().token
    }
    if (options.businessBot) {
        return businessBot().token
    }
    if (options.adminBot) {
        return adminBot().token
    }
    return shop?.bot.token ?? platformBot().token
}

/**
 * Calls the Worker API as `user` inside the app opened from a shop bot, the Zumda bot, Zumda
 * Biznes or the Zumda courier bot.
 */
export async function apiAs(
    user: TgUser,
    path: string,
    options: ApiOptions = {},
): Promise<Response> {
    const shop =
        options.shop && !options.via && !options.businessBot ? shopBySlug(options.shop) : null
    const token = signerToken(options, shop)
    const headers: Record<string, string> = {
        "X-Telegram-Init-Data": signInitData(user, token),
        Origin: "http://localhost:5173",
    }
    if (options.courierBot) {
        headers["X-Bot"] = "courier"
    } else if (options.businessBot) {
        headers["X-Bot"] = "business"
    } else if (options.adminBot) {
        headers["X-Bot"] = "admin"
    }
    if (options.shop && !options.courierBot) {
        headers["X-Shop"] = options.shop
    }
    if (options.via) {
        headers["X-Via"] = options.via
    }
    let body: BodyInit | undefined
    if (options.png) {
        headers["Content-Type"] = "image/png"
        body = new Uint8Array(options.png)
    } else if (options.json !== undefined) {
        headers["Content-Type"] = "application/json"
        body = JSON.stringify(options.json)
    }
    return fetchOnce(`${WORKER_URL}/api${path}`, {
        method: options.method ?? "GET",
        headers,
        body,
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
/** Yakkabog', where the stand's shops are: the pin of the orders `placeOrder` makes. */
export const STAND_PIN = { latitude: 38.9785, longitude: 66.6831 }

export async function placeOrder(
    customer: TgUser,
    shop: string,
    items: { productId: string; quantity: number; variantId?: string; addonIds?: string[] }[],
    extra: Record<string, unknown> = {},
): Promise<PlacedOrder> {
    await shopChat(shop).shareContact(customer, "+998901234567")
    const response = await apiAs(customer, "/orders", {
        shop,
        method: "POST",
        // Every order carries the customer's pin (owner's decision, November 2026).
        json: { items, address: "Navoiy 12", location: STAND_PIN, ...extra },
    })
    if (response.status !== 201) {
        throw new Error(`Order failed: ${response.status} ${await response.text()}`)
    }
    const order = (await response.json()) as PlacedOrder
    placedBy.set(order.id, { customer, shop })
    return order
}

/**
 * A screenshot of its own for each order: one picture sent for two orders warns the owner, which
 * the specs about that warning send on purpose.
 */
function receiptOf(orderId: string): Buffer {
    const digest = createHash("sha256").update(orderId).digest()
    return pngImage(32, [digest[0] ?? 0, digest[1] ?? 0, digest[2] ?? 0])
}

/** Who placed each order through `placeOrder`, and where: «Pul keldi» needs their screenshot. */
const placedBy = new Map<string, { customer: TgUser; shop: string }>()

/** «Chekni yuklash» and «O'tkazdim»: the screenshot of the transfer, as the app sends it. */
export async function sendReceipt(
    customer: TgUser,
    shop: string,
    orderId: string,
    picture: Buffer = pngImage(32),
): Promise<Response> {
    return apiAs(customer, `/orders/${orderId}/transfer-sent`, {
        shop,
        method: "POST",
        png: picture,
    })
}

/**
 * «Pul keldi»: the owner of `shop` saw the transfer on the card. The order is paid, accepted and
 * started in one step (the shop starts only after the money). The customer who placed it through
 * `placeOrder` sends the screenshot first, as «Pul keldi» waits for it (owner's decision, November
 * 2026); for an order placed in the browser, name its `customer`.
 */
export async function payAndAccept(
    owner: TgUser,
    shop: string,
    orderId: string,
    customer?: TgUser,
): Promise<Response> {
    const placed = placedBy.get(orderId) ?? (customer ? { customer, shop } : undefined)
    if (placed) {
        const sent = await sendReceipt(placed.customer, placed.shop, orderId, receiptOf(orderId))
        if (sent.status !== 200) {
            throw new Error(`Receipt failed: ${sent.status} ${await sent.text()}`)
        }
    }
    return apiAs(owner, `/owner/orders/${orderId}/payment`, {
        shop,
        method: "PATCH",
        json: { action: "paid" },
    })
}

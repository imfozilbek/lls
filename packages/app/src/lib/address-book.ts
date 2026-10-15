import type { OrderDTO, PaymentMethod } from "@zumda/core"

export type Point = { latitude: number; longitude: number }

/** The last delivery, kept on this phone: the next order starts filled in. */
export interface SavedAddress {
    address: string
    landmark: string
    /** The map pin too: a network courier sees how far the order goes only with it. */
    location: Point | null
    /** A regular water customer hands back the same number of bottles each time. */
    bottlesReturned: number
    /** How the customer paid last: the shop that takes both starts from it. */
    paymentMethod?: PaymentMethod
}

/** The checkout as it is being filled in, per shop: nothing typed is lost on «Back». */
export interface Draft {
    address: string
    landmark: string
    comment: string
    location: Point | null
    bottlesReturned: number
}

const LAST_ADDRESS_KEY = "zumda:address"
const DRAFT_PREFIX = "zumda:checkout-draft:"
const EMPTY: SavedAddress = { address: "", landmark: "", location: null, bottlesReturned: 0 }

function point(value: unknown): Point | null {
    const p = value as Partial<Point> | null | undefined
    return typeof p?.latitude === "number" && typeof p.longitude === "number"
        ? { latitude: p.latitude, longitude: p.longitude }
        : null
}

function text(value: unknown): string {
    return typeof value === "string" ? value : ""
}

function count(value: unknown): number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0
}

function read(key: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? "null") as unknown
        return typeof parsed === "object" && parsed !== null
            ? (parsed as Record<string, unknown>)
            : null
    } catch {
        return null
    }
}

function write(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch {
        // Storage full or blocked: the customer types it again next time, nothing breaks.
    }
}

export function loadAddress(): SavedAddress {
    const saved = read(LAST_ADDRESS_KEY)
    if (!saved) {
        return { ...EMPTY }
    }
    const method = saved["paymentMethod"]
    return {
        address: text(saved["address"]),
        landmark: text(saved["landmark"]),
        location: point(saved["location"]),
        bottlesReturned: count(saved["bottlesReturned"]),
        ...(method === "card_transfer" || method === "cash"
            ? { paymentMethod: method as PaymentMethod }
            : {}),
    }
}

export function saveAddress(value: SavedAddress): void {
    write(LAST_ADDRESS_KEY, value)
}

/**
 * A customer on a new phone (or after Telegram cleared its storage): the newest order's place
 * stands in, so the checkout is not empty for someone who ordered before. Never over a place
 * this phone already keeps.
 */
export function rememberFromOrder(
    order: Pick<OrderDTO, "address" | "landmark" | "location">,
): void {
    const saved = loadAddress()
    if (saved.address || saved.landmark || saved.location) {
        return
    }
    saveAddress({
        ...saved,
        address: order.address,
        landmark: order.landmark ?? "",
        location: order.location ? point(order.location) : null,
    })
}

export function loadDraft(shop: string): Draft | null {
    const draft = read(DRAFT_PREFIX + shop)
    if (!draft) {
        return null
    }
    return {
        address: text(draft["address"]),
        landmark: text(draft["landmark"]),
        comment: text(draft["comment"]),
        location: point(draft["location"]),
        bottlesReturned: count(draft["bottlesReturned"]),
    }
}

export function saveDraft(shop: string, draft: Draft): void {
    write(DRAFT_PREFIX + shop, draft)
}

export function clearDraft(shop: string): void {
    try {
        localStorage.removeItem(DRAFT_PREFIX + shop)
    } catch {
        // Nothing to clear in blocked storage.
    }
}

/** The last order placed through the Zumda showcase: Zumda | Shop leads back to it. */
export interface ShowcaseOrder {
    slug: string
    shopName: string
    id: string
    number: number
    at: number
}

const SHOWCASE_ORDER_KEY = "zumda:showcase-order"
/** Long enough for any delivery of the day; then the banner is gone by itself. */
const SHOWCASE_ORDER_MS = 12 * 60 * 60 * 1000

export function saveShowcaseOrder(order: ShowcaseOrder): void {
    write(SHOWCASE_ORDER_KEY, order)
}

export function loadShowcaseOrder(now = Date.now()): ShowcaseOrder | null {
    const saved = read(SHOWCASE_ORDER_KEY)
    const at = saved?.["at"]
    const number = saved?.["number"]
    if (
        !saved ||
        typeof at !== "number" ||
        typeof number !== "number" ||
        now - at > SHOWCASE_ORDER_MS
    ) {
        return null
    }
    const slug = text(saved["slug"])
    const id = text(saved["id"])
    return slug && id ? { slug, id, number, at, shopName: text(saved["shopName"]) } : null
}

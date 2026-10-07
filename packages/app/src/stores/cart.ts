import { packagesOf, unitScale } from "@zumda/core"
import { create } from "zustand"

import type { ProductDTO } from "@zumda/core"

/** A line holds at most 99 steps: 99 pieces, or 49.5 kg with a 500 g step. */
export const MAX_STEPS = 99
/** Upper bound for anything read back from storage (grams of the largest step). */
const MAX_STORED = 1_000_000
const STORAGE_PREFIX = "zumda:cart:"

/**
 * Only ids and quantities are stored: pieces, or grams for weight items. A line's key is the
 * product id, or `id~variant~addon.addon` for a product with options (see `lineKey`).
 * Names and prices always come from the fresh catalog.
 */
export type CartLines = Record<string, number>

/** The customer's pick of a product with variants and add-ons. */
export interface Pick {
    variantId?: string
    addonIds: string[]
}

const KEY_SEPARATOR = "~"
const ADDON_SEPARATOR = "."

/** One cart line per product and pick: «Latte 0,4 l + sirop» and «Latte 0,3 l» are two lines. */
export function lineKey(productId: string, pick?: Pick): string {
    if (!pick) {
        return productId
    }
    const addons = [...new Set(pick.addonIds)].sort().join(ADDON_SEPARATOR)
    return [productId, pick.variantId ?? "", addons].join(KEY_SEPARATOR)
}

function parseKey(key: string): { productId: string; pick?: Pick } {
    const [productId = "", variantId = "", addons = ""] = key.split(KEY_SEPARATOR)
    if (!key.includes(KEY_SEPARATOR)) {
        return { productId }
    }
    return {
        productId,
        pick: {
            ...(variantId ? { variantId } : {}),
            addonIds: addons ? addons.split(ADDON_SEPARATOR) : [],
        },
    }
}

/** The product a line belongs to, whatever was picked. */
export function productOfKey(key: string): string {
    return parseKey(key).productId
}

/**
 * The price of one unit of a pick and its words, as the server will compute them, or null when
 * the pick no longer fits the product (the owner changed the variants).
 */
export function pickPrice(
    product: ProductDTO,
    pick: Pick | undefined,
): { unitPrice: number; label?: string } | null {
    const options = product.options
    if (!pick) {
        return options?.variants.length ? null : { unitPrice: product.price }
    }
    const variant = options?.variants.find((v) => v.id === pick.variantId)
    if (!options || options.variants.length > 0 !== Boolean(variant)) {
        return null
    }
    // In the owner's order, as the server words it.
    const picked = options.addons.filter((a) => pick.addonIds.includes(a.id))
    if (picked.length !== new Set(pick.addonIds).size) {
        return null
    }
    const words = [variant?.name, picked.map((a) => a.name).join(", ")].filter(Boolean)
    return {
        unitPrice: (variant?.price ?? product.price) + picked.reduce((sum, a) => sum + a.price, 0),
        label: words.length > 0 ? words.join(" · ") : undefined,
    }
}

interface CartState {
    shop: string | null
    lines: CartLines
    load(shop: string): void
    /** Adds one step: 1 piece, or e.g. 500 g for a weight item. */
    add(productId: string, step?: number): void
    remove(productId: string, step?: number): void
    setQuantity(productId: string, quantity: number): void
    clear(): void
    /** Puts a past order back into the cart at today's prices. Returns how many were skipped. */
    refill(
        items: readonly {
            productId: string
            quantity: number
            options?: { variantId?: string; addonIds: string[] }
        }[],
        catalog: readonly ProductDTO[],
    ): number
    /**
     * Drops lines whose product left the catalog, or whose pick no longer fits it. Returns how
     * many were dropped.
     */
    prune(catalog: readonly ProductDTO[]): number
}

function read(shop: string): CartLines {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + shop)
        const parsed = raw ? (JSON.parse(raw) as unknown) : {}
        if (typeof parsed !== "object" || parsed === null) {
            return {}
        }
        const lines: CartLines = {}
        for (const [id, qty] of Object.entries(parsed)) {
            if (typeof qty === "number" && Number.isInteger(qty) && qty > 0) {
                lines[id] = Math.min(qty, MAX_STORED)
            }
        }
        return lines
    } catch {
        return {}
    }
}

function write(shop: string | null, lines: CartLines): void {
    if (!shop) {
        return
    }
    try {
        localStorage.setItem(STORAGE_PREFIX + shop, JSON.stringify(lines))
    } catch {
        // Storage can be full or blocked; the cart still works for this session.
    }
}

/** One cart per shop, so switching between shop bots never mixes or wipes carts. */
export const useCart = create<CartState>((set, get) => {
    const update = (lines: CartLines): void => {
        write(get().shop, lines)
        set({ lines })
    }
    return {
        shop: null,
        lines: {},
        load: (shop): void => set({ shop, lines: read(shop) }),
        add: (productId, step = 1): void => {
            const current = get().lines[productId] ?? 0
            update({ ...get().lines, [productId]: Math.min(current + step, step * MAX_STEPS) })
        },
        remove: (productId, step = 1): void => {
            const current = get().lines[productId] ?? 0
            const lines = { ...get().lines }
            if (current <= step) {
                delete lines[productId]
            } else {
                lines[productId] = current - step
            }
            update(lines)
        },
        setQuantity: (productId, quantity): void => {
            const lines = { ...get().lines }
            if (quantity <= 0) {
                delete lines[productId]
            } else {
                lines[productId] = Math.min(quantity, MAX_STORED)
            }
            update(lines)
        },
        clear: (): void => update({}),
        refill: (items, catalog): number => {
            const onSale = new Map(catalog.filter((p) => p.isAvailable).map((p) => [p.id, p]))
            const lines = { ...get().lines }
            let skipped = 0
            for (const item of items) {
                const product = onSale.get(item.productId)
                const pick = item.options
                    ? { variantId: item.options.variantId, addonIds: item.options.addonIds }
                    : undefined
                if (product && pickPrice(product, pick)) {
                    lines[lineKey(item.productId, pick)] = item.quantity
                } else {
                    skipped++
                }
            }
            update(lines)
            return skipped
        },
        prune: (catalog): number => {
            // Sold out today stays in the cart (shown apart); gone or changed products leave it.
            const known = new Map(catalog.map((p) => [p.id, p]))
            const lines = { ...get().lines }
            const gone = Object.keys(lines).filter((key) => {
                const { productId, pick } = parseKey(key)
                const product = known.get(productId)
                return !product || !pickPrice(product, pick)
            })
            if (gone.length === 0) {
                return 0
            }
            for (const id of gone) {
                delete lines[id]
            }
            update(lines)
            return gone.length
        },
    }
})

export interface CartLine {
    /** The key in `CartLines`: the product id, or the product with its pick. */
    key: string
    product: ProductDTO
    pick?: Pick
    /** «0,4 l · Karamel sirop». */
    label?: string
    quantity: number
    total: number
}

export interface CartSummary {
    lines: CartLine[]
    /** Lines whose product is gone or sold out; they are not ordered. */
    unavailable: CartLine[]
    /** Number of lines (a 1.5 kg line counts once). */
    count: number
    subtotal: number
    /** Returnable bottles ordered: they may carry a deposit. */
    returnable: number
}

/** Price per piece or per kg × quantity in pieces or grams, rounded like the server does. */
export function lineTotal(
    product: ProductDTO,
    quantity: number,
    unitPrice = product.price,
): number {
    return Math.round((unitPrice * quantity) / unitScale(product.unit))
}

/** Joins stored quantities with the current catalog. Prices are always today's prices. */
export function summarize(lines: CartLines, catalog: readonly ProductDTO[]): CartSummary {
    const byId = new Map(catalog.map((p) => [p.id, p]))
    const available: CartLine[] = []
    const unavailable: CartLine[] = []
    for (const [key, quantity] of Object.entries(lines)) {
        const { productId, pick } = parseKey(key)
        const product = byId.get(productId)
        if (!product) {
            continue
        }
        const priced = pickPrice(product, pick)
        const line = {
            key,
            product,
            pick,
            label: priced?.label,
            quantity,
            total: lineTotal(product, quantity, priced?.unitPrice),
        }
        ;(product.isAvailable && priced ? available : unavailable).push(line)
    }
    return {
        lines: available,
        unavailable,
        count: available.length,
        subtotal: available.reduce((sum, l) => sum + l.total, 0),
        returnable: available.reduce(
            (sum, l) => sum + (l.product.returnable ? packagesOf(l.product.unit, l.quantity) : 0),
            0,
        ),
    }
}

export interface DeliveryRules {
    fee: number
    freeFrom?: number
    minOrder?: number
}

export function deliveryFee(subtotal: number, rules: DeliveryRules): number {
    return rules.freeFrom !== undefined && subtotal >= rules.freeFrom ? 0 : rules.fee
}

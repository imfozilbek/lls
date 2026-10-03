import { unitScale } from "@zumda/core"
import { create } from "zustand"

import type { ProductDTO } from "@zumda/core"

/** A line holds at most 99 steps: 99 pieces, or 49.5 kg with a 500 g step. */
export const MAX_STEPS = 99
/** Upper bound for anything read back from storage (grams of the largest step). */
const MAX_STORED = 1_000_000
const STORAGE_PREFIX = "lls:cart:"

/**
 * Only ids and quantities are stored: pieces, or grams for weight items.
 * Names and prices always come from the fresh catalog.
 */
export type CartLines = Record<string, number>

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
        items: readonly { productId: string; quantity: number }[],
        catalog: readonly ProductDTO[],
    ): number
    /** Drops lines whose product is no longer on sale. Returns how many were dropped. */
    prune(availableIds: readonly string[]): number
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
            const onSale = new Set(catalog.filter((p) => p.isAvailable).map((p) => p.id))
            const lines = { ...get().lines }
            let skipped = 0
            for (const item of items) {
                if (onSale.has(item.productId)) {
                    lines[item.productId] = item.quantity
                } else {
                    skipped++
                }
            }
            update(lines)
            return skipped
        },
        prune: (availableIds): number => {
            const available = new Set(availableIds)
            const lines = { ...get().lines }
            const gone = Object.keys(lines).filter((id) => !available.has(id))
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
    product: ProductDTO
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
export function lineTotal(product: ProductDTO, quantity: number): number {
    return Math.round((product.price * quantity) / unitScale(product.unit))
}

/** Joins stored quantities with the current catalog. Prices are always today's prices. */
export function summarize(lines: CartLines, catalog: readonly ProductDTO[]): CartSummary {
    const byId = new Map(catalog.map((p) => [p.id, p]))
    const available: CartLine[] = []
    const unavailable: CartLine[] = []
    for (const [id, quantity] of Object.entries(lines)) {
        const product = byId.get(id)
        if (!product) {
            continue
        }
        const line = { product, quantity, total: lineTotal(product, quantity) }
        ;(product.isAvailable ? available : unavailable).push(line)
    }
    return {
        lines: available,
        unavailable,
        count: available.length,
        subtotal: available.reduce((sum, l) => sum + l.total, 0),
        returnable: available.reduce((sum, l) => sum + (l.product.returnable ? l.quantity : 0), 0),
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

import { create } from "zustand"

import type { ProductDTO } from "@lls/core"

export const MAX_QUANTITY = 99
const STORAGE_PREFIX = "lls:cart:"

/** Only ids and quantities are stored. Names and prices always come from the fresh catalog. */
export type CartLines = Record<string, number>

interface CartState {
    shop: string | null
    lines: CartLines
    load(shop: string): void
    add(productId: string): void
    remove(productId: string): void
    setQuantity(productId: string, quantity: number): void
    clear(): void
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
                lines[id] = Math.min(qty, MAX_QUANTITY)
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
        add: (productId): void => {
            const current = get().lines[productId] ?? 0
            update({ ...get().lines, [productId]: Math.min(current + 1, MAX_QUANTITY) })
        },
        remove: (productId): void => {
            const current = get().lines[productId] ?? 0
            const lines = { ...get().lines }
            if (current <= 1) {
                delete lines[productId]
            } else {
                lines[productId] = current - 1
            }
            update(lines)
        },
        setQuantity: (productId, quantity): void => {
            const lines = { ...get().lines }
            if (quantity <= 0) {
                delete lines[productId]
            } else {
                lines[productId] = Math.min(quantity, MAX_QUANTITY)
            }
            update(lines)
        },
        clear: (): void => update({}),
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
    count: number
    subtotal: number
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
        const line = { product, quantity, total: product.price * quantity }
        ;(product.isAvailable ? available : unavailable).push(line)
    }
    return {
        lines: available,
        unavailable,
        count: available.reduce((sum, l) => sum + l.quantity, 0),
        subtotal: available.reduce((sum, l) => sum + l.total, 0),
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

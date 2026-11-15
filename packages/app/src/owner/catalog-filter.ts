import { onSaleNow, stoppedToday } from "./stopped.js"

import type { ProductDTO } from "@zumda/core"

/**
 * The catalog's state chips (owner's decision, November 2026: a toy shop of 100+ products could
 * not find what was off sale): on sale, run out (counted, none left), off for today, hidden for
 * good, without a photo.
 */
export type CatalogFilter = "all" | "onSale" | "soldOut" | "today" | "hidden" | "noPhoto"

export const CATALOG_FILTERS: readonly CatalogFilter[] = [
    "all",
    "onSale",
    "soldOut",
    "today",
    "hidden",
    "noPhoto",
]

/** A catalog this long gets a search: past one screen of rows. */
export const OWNER_SEARCH_FROM = 12

export function inFilter(product: ProductDTO, filter: CatalogFilter): boolean {
    switch (filter) {
        case "onSale":
            return onSaleNow(product) && product.soldOut !== true
        case "soldOut":
            return onSaleNow(product) && product.soldOut === true
        case "today":
            return product.isAvailable && stoppedToday(product)
        case "hidden":
            return !product.isAvailable
        case "noPhoto":
            return !product.imageKey
        default:
            return true
    }
}

/** How many products each chip leaves. */
export function filterCounts(products: readonly ProductDTO[]): Record<CatalogFilter, number> {
    const counts = { all: 0, onSale: 0, soldOut: 0, today: 0, hidden: 0, noPhoto: 0 }
    for (const filter of CATALOG_FILTERS) {
        counts[filter] = products.filter((product) => inFilter(product, filter)).length
    }
    return counts
}

/**
 * The chips worth showing: «Hammasi» and every state with products, once something is off sale,
 * run out or without a photo (a catalog all on sale with photos needs no filter).
 */
export function shownFilters(counts: Record<CatalogFilter, number>): CatalogFilter[] {
    const used = CATALOG_FILTERS.filter((filter) => filter === "all" || counts[filter] > 0)
    const worth = counts.soldOut + counts.today + counts.hidden + counts.noPhoto > 0
    return worth && used.length > 2 ? used : []
}

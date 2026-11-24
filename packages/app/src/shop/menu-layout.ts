import { StorefrontLayout } from "@zumda/core"

import { matchesChip } from "./menu-chips.js"

import type { ProductDTO } from "@zumda/core"

/** «Yangi kelganlar» (goal 24): at most this many on the shelf. */
export const NEW_SHELF_MAX = 10
/** Fewer new products than this: no shelf (two would look like a mistake, not news). */
export const NEW_SHELF_MIN = 3
/** The tab «Hammasini ko'rish» presses: never a category id or an age («3+»). */
export const NEW_CHIP = "@new"

/** Fewer than half of the products have a photo: the list reads better than tiles. */
export function prefersList(catalog: readonly ProductDTO[]): boolean {
    const withPhoto = catalog.filter((product) => product.imageKey).length
    return withPhoto * 2 < catalog.length
}

/**
 * The layout customers see: the owner's choice, or, while there is none, the photos' (a list
 * when fewer than half of the products have one, two columns otherwise).
 */
export function resolveLayout(
    chosen: StorefrontLayout | null,
    catalog: readonly ProductDTO[],
): StorefrontLayout {
    if (chosen) {
        return chosen
    }
    return prefersList(catalog) ? StorefrontLayout.LIST : StorefrontLayout.GRID
}

/**
 * What the screen draws now. The shelves show the whole catalog; a tab or a search shows its
 * products in two columns, since one shelf of them would hide the rest sideways.
 */
export function viewOf(layout: StorefrontLayout, narrowed: boolean): StorefrontLayout {
    return layout === StorefrontLayout.SHELVES && narrowed ? StorefrontLayout.GRID : layout
}

/** Every new product (the server marks them, `addedAt`), the newest first. */
export function newArrivals(catalog: readonly ProductDTO[]): ProductDTO[] {
    return catalog
        .filter((product) => product.addedAt !== undefined)
        .sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? "") || a.position - b.position)
}

/** «Yangi kelganlar»: the newest few, or none when there are too few to be news. */
export function newShelf(catalog: readonly ProductDTO[]): ProductDTO[] {
    const fresh = newArrivals(catalog)
    return fresh.length < NEW_SHELF_MIN ? [] : fresh.slice(0, NEW_SHELF_MAX)
}

export interface Shelf {
    /** A category id (its name comes from the dictionary). */
    category: string
    products: ProductDTO[]
}

/**
 * A shelf a category, the fullest first (ties keep the catalog's order); a product stands on
 * every shelf of its categories, in the catalog's order. Ages are tabs, never shelves.
 */
export function shelvesOf(catalog: readonly ProductDTO[]): Shelf[] {
    const shelves = new Map<string, ProductDTO[]>()
    for (const product of catalog) {
        for (const category of [product.category, ...(product.moreCategories ?? [])]) {
            const shelf = shelves.get(category)
            if (shelf) {
                if (!shelf.includes(product)) {
                    shelf.push(product)
                }
            } else {
                shelves.set(category, [product])
            }
        }
    }
    return [...shelves.entries()]
        .map(([category, products]) => ({ category, products }))
        .sort((a, b) => b.products.length - a.products.length)
}

/** A product under the tab pressed: an age, a category, or «Yangi kelganlar». */
export function underChip(product: ProductDTO, chip: string): boolean {
    return chip === NEW_CHIP ? product.addedAt !== undefined : matchesChip(product, chip)
}

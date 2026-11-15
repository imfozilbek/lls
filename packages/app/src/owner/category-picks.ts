import { KIDS_CATEGORIES, MAX_CATEGORIES } from "@zumda/core"

import type { Category, ProductDTO } from "@zumda/core"

/** A product's categories in the form: the main one (orders keep it) and the further ones. */
export interface Picks {
    category: Category
    moreCategories: Category[]
}

export function allOf(picks: Picks): Category[] {
    return [picks.category, ...picks.moreCategories]
}

/**
 * A tap on a category chip. While the category is only a guess (the owner has picked nothing),
 * the tap replaces it; after that taps add and remove, up to `MAX_CATEGORIES`, never the last
 * one. A removed main category hands its place to the next one. `null`: no room for another.
 */
export function togglePick(current: Picks, tapped: Category, picked: boolean): Picks | null {
    if (!picked) {
        return { category: tapped, moreCategories: [] }
    }
    const all = allOf(current)
    if (all.includes(tapped)) {
        const [main, ...more] = all.length > 1 ? all.filter((c) => c !== tapped) : all
        return { category: main ?? current.category, moreCategories: more }
    }
    if (all.length >= MAX_CATEGORIES) {
        return null
    }
    return { category: current.category, moreCategories: [...current.moreCategories, tapped] }
}

/** The shop's own categories, the most used first: a toy shop's next toy is one tap away. */
export function usedCategories(products: readonly ProductDTO[] | null): Category[] {
    const counts = new Map<Category, number>()
    for (const product of products ?? []) {
        for (const category of [product.category, ...(product.moreCategories ?? [])]) {
            counts.set(category, (counts.get(category) ?? 0) + 1)
        }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([category]) => category)
}

/** Children's goods ask for the age they are for. */
export function asksAge(picks: Picks): boolean {
    return allOf(picks).some((category) => KIDS_CATEGORIES.includes(category))
}

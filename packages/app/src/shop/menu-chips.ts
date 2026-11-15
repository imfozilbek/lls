import { ageLabel } from "@zumda/core"

import type { ProductDTO } from "@zumda/core"

/**
 * The storefront's tabs: the ages first, «0+», «3+» (only when the products are for two ages or
 * more), then every category a product stands in, in catalog order. A tab is a category id or an
 * age label; fewer than two tabs show none.
 */
export function menuChips(catalog: readonly ProductDTO[]): string[] {
    const ages = [...new Set(catalog.flatMap((p) => (p.ageFrom === undefined ? [] : [p.ageFrom])))]
    const categories = catalog.flatMap((p) => [p.category, ...(p.moreCategories ?? [])])
    return [
        ...(ages.length > 1 ? ages.sort((a, b) => a - b).map(ageLabel) : []),
        ...new Set(categories),
    ]
}

/** A product under a tab: its age, or any of its categories. */
export function matchesChip(product: ProductDTO, chip: string): boolean {
    if (chip.endsWith("+")) {
        return product.ageFrom !== undefined && ageLabel(product.ageFrom) === chip
    }
    return product.category === chip || (product.moreCategories ?? []).some((c) => c === chip)
}

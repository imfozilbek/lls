import { ageLabel } from "@zumda/core"

import type { ProductDTO } from "@zumda/core"

/** «3+»: the child's age a toy is for, next to its price. */
export function AgeBadge({ product }: { product: ProductDTO }): React.JSX.Element | null {
    if (product.ageFrom === undefined) {
        return null
    }
    return (
        <span className="ml-1.5 rounded-full bg-tg-secondary px-1.5 py-0.5 text-xs font-semibold text-tg-text">
            {ageLabel(product.ageFrom)}
        </span>
    )
}

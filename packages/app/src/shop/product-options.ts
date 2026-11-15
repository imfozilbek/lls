import type { ProductDTO } from "@zumda/core"

/** A product the customer must pick for: a variant, or add-ons to choose. */
export function hasOptions(product: ProductDTO): boolean {
    return (product.options?.variants.length ?? 0) + (product.options?.addons.length ?? 0) > 0
}

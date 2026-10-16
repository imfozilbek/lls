import type { ProductDTO } from "@zumda/core"

/** On today's stop-list: the mark is still in the future. */
export function stoppedToday(product: ProductDTO): boolean {
    return (
        product.unavailableUntil !== undefined && Date.parse(product.unavailableUntil) > Date.now()
    )
}

/** On sale right now: neither taken off for good nor stopped for today. */
export function onSaleNow(product: ProductDTO): boolean {
    return product.isAvailable && !stoppedToday(product)
}

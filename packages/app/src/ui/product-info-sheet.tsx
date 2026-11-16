import { useLanguage, useT } from "../i18n/index.js"
import { formatMoney } from "../lib/format.js"
import { AgeBadge } from "../shop/age-badge.js"
import { ProductGallery } from "../shop/product-gallery.js"

import { Sheet } from "./sheet.js"

import type { ProductDTO } from "@zumda/core"

/**
 * A product opened from an order line (a shop owner's ask, November 2026): its photos, price
 * and description, to see what to collect or what was ordered. Nothing to add: an order is not a
 * cart.
 */
export function ProductInfoSheet({
    product,
    onClose,
}: {
    product: ProductDTO
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const prices = new Set(product.options?.variants.map((variant) => variant.price))
    const unit = (t.units as Record<string, string>)[product.unit] ?? product.unit
    return (
        <Sheet title={product.name} onClose={onClose}>
            <div className="flex flex-col gap-3">
                <ProductGallery product={product} />
                <p>
                    <span className="text-lg font-bold">
                        {formatMoney(product.price, language)}
                    </span>
                    <span className="text-tg-hint">
                        {prices.size > 1 ? ` ${t.shop.from}` : ` / ${unit}`}
                    </span>
                    <AgeBadge product={product} />
                </p>
                {product.description ? (
                    <p className="whitespace-pre-line text-tg-subtitle">{product.description}</p>
                ) : null}
            </div>
        </Sheet>
    )
}

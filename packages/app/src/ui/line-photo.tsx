import { Suspense, lazy, useMemo, useState } from "react"

import { fill, useT } from "../i18n/index.js"
import { haptic } from "../lib/telegram.js"

import { SheetLoading } from "./boundary.js"
import { ProductImage } from "./product-image.js"

import type { OrderItemDTO, ProductDTO } from "@zumda/core"

/** Loaded on the first tap: a line's photo never adds to the first download. */
const ProductInfoSheet = lazy(() =>
    import("./product-info-sheet.js").then((m) => ({ default: m.ProductInfoSheet })),
)

/** The shop's products by id, for an order's lines to find theirs. */
export function useProductsById(
    products: readonly ProductDTO[] | null | undefined,
): ReadonlyMap<string, ProductDTO> {
    return useMemo(
        () => new Map((products ?? []).map((product) => [product.id, product])),
        [products],
    )
}

/** The sheet a line's photo opens, and how to open it. */
export function useProductSheet(): {
    open(product: ProductDTO): void
    sheet: React.ReactNode
} {
    const [shown, setShown] = useState<ProductDTO | null>(null)
    const sheet = shown ? (
        <Suspense fallback={<SheetLoading />}>
            <ProductInfoSheet product={shown} onClose={(): void => setShown(null)} />
        </Suspense>
    ) : null
    return { open: setShown, sheet }
}

/**
 * An order line's product photo (a shop owner's ask, November 2026): a tap opens the product. A
 * product the shop deleted, or one this screen does not know, keeps its category's picture and
 * opens nothing.
 */
export function LinePhoto({
    item,
    product,
    onOpen,
    className,
}: {
    item: OrderItemDTO
    product: ProductDTO | undefined
    onOpen(product: ProductDTO): void
    className?: string
}): React.JSX.Element {
    const t = useT()
    const picture = (
        <ProductImage
            imageKey={product?.imageKey}
            category={item.category}
            alt=""
            iconSize={20}
            className="h-11 w-11 rounded-control"
        />
    )
    if (!product) {
        return <span className={`shrink-0 ${className ?? ""}`}>{picture}</span>
    }
    return (
        <button
            type="button"
            aria-label={fill(t.order.viewProduct, { name: item.name })}
            onClick={(): void => {
                haptic.tap()
                onOpen(product)
            }}
            className={`tap shrink-0 rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${className ?? ""}`}
        >
            {picture}
        </button>
    )
}

import { fill, useT } from "../i18n/index.js"

import { PhotoStrip } from "./photo-strip.js"

import type { ProductDTO } from "@zumda/core"

/**
 * The product's photos up close (owner's decision, November 2026: up to three): one photo as
 * before; more, a strip the customer swipes with a dot for each. In the sheet the strip keeps
 * every page gesture off (`ownsSwipe`).
 */
export function ProductGallery({ product }: { product: ProductDTO }): React.JSX.Element | null {
    const t = useT()
    return (
        <PhotoStrip
            product={product}
            frame="aspect-[4/3] rounded-tile"
            dotLabel={(n): string => fill(t.shop.photoOf, { n })}
            ownsSwipe
        />
    )
}

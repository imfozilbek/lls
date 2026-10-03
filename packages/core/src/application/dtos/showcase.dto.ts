import { toProductDTO } from "./product.dto.js"

import type { ProductDTO } from "./product.dto.js"
import type { Business } from "../../domain/entities/business.js"
import type { Product } from "../../domain/entities/product.js"

/** Just enough of the shop to show next to a product and open its storefront. */
export interface ShowcaseShopRef {
    slug: string
    name: string
    brandColor: string
    logoKey?: string
    isOpen: boolean
}

/** A product found in the Zumda showcase. */
export interface ShowcaseProductDTO extends ProductDTO {
    shop: ShowcaseShopRef
}

export function toShowcaseShopRef(business: Business, now: Date): ShowcaseShopRef {
    return {
        slug: business.slug.value,
        name: business.name,
        brandColor: business.brandColor.hex,
        logoKey: business.logoKey,
        isOpen: business.isOpenAt(now),
    }
}

export function toShowcaseProductDTO(product: Product, shop: ShowcaseShopRef): ShowcaseProductDTO {
    return { ...toProductDTO(product), shop }
}

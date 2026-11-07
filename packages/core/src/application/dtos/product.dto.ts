import type { Product } from "../../domain/entities/product.js"
import type { Age } from "../../domain/enums/age.js"
import type { Category } from "../../domain/enums/category.js"
import type { Unit } from "../../domain/enums/unit.js"
import type { ProductOptionsProps } from "../../domain/value-objects/product-options.js"

export interface ProductDTO {
    id: string
    businessId: string
    name: string
    description?: string
    price: number
    unit: Unit
    /** Selling step in base units: grams for `kg`, 1 for pieces. Quantities are multiples of it. */
    step: number
    /** The main category; an order line keeps it. */
    category: Category
    /** Further categories it also stands in on the storefront; absent when none. */
    moreCategories?: Category[]
    /** The child's age it is for, from this many years («3+»); absent when not given. */
    ageFrom?: Age
    imageKey?: string
    isAvailable: boolean
    /** On today's stop-list until this moment (ISO); back on sale after it. */
    unavailableUntil?: string
    /** A returnable bottle with a deposit (water shops). */
    returnable: boolean
    position: number
    /** Variants (one is picked, each with its price) and add-ons. */
    options?: ProductOptionsProps
}

export function toProductDTO(product: Product): ProductDTO {
    return {
        id: product.id,
        businessId: product.businessId,
        name: product.name,
        description: product.description,
        price: product.price.amount,
        unit: product.unit,
        step: product.step,
        category: product.category,
        ...(product.moreCategories.length > 0 ? { moreCategories: product.moreCategories } : {}),
        ...(product.ageFrom === undefined ? {} : { ageFrom: product.ageFrom }),
        imageKey: product.imageKey,
        isAvailable: product.isAvailable,
        unavailableUntil: product.unavailableUntil?.toISOString(),
        returnable: product.returnable,
        position: product.position,
        ...(product.options ? { options: product.options.toJSON() } : {}),
    }
}

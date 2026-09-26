import type { Product } from "../../domain/entities/product.js"
import type { Category } from "../../domain/enums/category.js"
import type { Unit } from "../../domain/enums/unit.js"

export interface ProductDTO {
    id: string
    businessId: string
    name: string
    description?: string
    price: number
    unit: Unit
    /** Selling step in base units: grams for `kg`, 1 for pieces. Quantities are multiples of it. */
    step: number
    category: Category
    imageKey?: string
    isAvailable: boolean
    /** On today's stop-list until this moment (ISO); back on sale after it. */
    unavailableUntil?: string
    /** A returnable bottle with a deposit (water shops). */
    returnable: boolean
    position: number
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
        imageKey: product.imageKey,
        isAvailable: product.isAvailable,
        unavailableUntil: product.unavailableUntil?.toISOString(),
        returnable: product.returnable,
        position: product.position,
    }
}

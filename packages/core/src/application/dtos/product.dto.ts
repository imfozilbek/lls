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
    category: Category
    imageKey?: string
    isAvailable: boolean
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
        category: product.category,
        imageKey: product.imageKey,
        isAvailable: product.isAvailable,
        position: product.position,
    }
}

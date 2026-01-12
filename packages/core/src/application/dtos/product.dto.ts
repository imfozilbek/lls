import type { MoneyDTO } from "./common.dto.js"
import type { Product } from "../../domain/entities/product.js"

export interface ProductDTO {
    id: string
    businessId: string
    name: string
    description: string
    price: MoneyDTO
    category: string
    imageUrl?: string
    isAvailable: boolean
    createdAt: string
    updatedAt: string
}

export interface CreateProductInput {
    businessId: string
    name: string
    description: string
    price: MoneyDTO
    category: string
    imageUrl?: string
}

export interface UpdateProductInput {
    name?: string
    description?: string
    price?: MoneyDTO
    category?: string
    imageUrl?: string
}

export function toProductDTO(product: Product): ProductDTO {
    return {
        id: product.id,
        businessId: product.businessId,
        name: product.name,
        description: product.description,
        price: {
            amount: product.price.amount,
            currency: product.price.currency,
        },
        category: product.category,
        imageUrl: product.imageUrl,
        isAvailable: product.isAvailable,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
    }
}

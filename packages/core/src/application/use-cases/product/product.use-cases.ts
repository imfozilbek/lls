import { Product } from "../../../domain/entities/product.js"
import { CATEGORIES } from "../../../domain/enums/category.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { requireOneOf } from "../../../domain/shared/guards.js"
import { mapPage, normalizePage } from "../../dtos/pagination.js"
import { toProductDTO } from "../../dtos/product.dto.js"
import { requireBusiness, requireOwnedBusiness } from "../shared.js"

import type { ProductPatch } from "../../../domain/entities/product.js"
import type { ProductOptionsProps } from "../../../domain/value-objects/product-options.js"
import type { Page } from "../../dtos/pagination.js"
import type { ProductDTO } from "../../dtos/product.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { ProductRepository } from "../../ports/product-repository.js"

export interface CreateProductInput {
    actorTelegramId: number
    businessId: string
    name: string
    description?: string
    price: number
    unit: string
    category: string
    step?: number
    returnable?: boolean
    position?: number
    options?: ProductOptionsProps
}

export class CreateProductUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly products: ProductRepository,
    ) {}

    async execute(input: CreateProductInput): Promise<ProductDTO> {
        await requireOwnedBusiness(this.businesses, input.businessId, input.actorTelegramId)
        const product = Product.create({
            id: crypto.randomUUID(),
            businessId: input.businessId,
            name: input.name,
            description: input.description,
            price: input.price,
            unit: input.unit,
            category: input.category,
            step: input.step,
            returnable: input.returnable,
            position: input.position,
            options: input.options,
        })
        await this.products.save(product)
        return toProductDTO(product)
    }
}

/** At most this many products in one list: one D1 batch, far below the free plan's daily writes. */
export const MAX_PRODUCTS_AT_ONCE = 50

export interface CreateProductsInput {
    actorTelegramId: number
    businessId: string
    items: Omit<CreateProductInput, "actorTelegramId" | "businessId">[]
}

export interface CreatedProducts {
    created: ProductDTO[]
    /** Names already in the shop or twice in the list: left out, the shop keeps one of each. */
    skipped: string[]
}

/** The same name as people read it: no case, no apostrophe, one space. */
function sameName(name: string): string {
    return name
        .toLowerCase()
        .replace(/['ʻʼ‘’`]/g, "")
        .replace(/\s+/g, " ")
        .trim()
}

/**
 * «Ro'yxat bilan qo'shish»: many products in one go (goal 17). Every row is checked first; any
 * wrong row stops the whole list, so nothing half-saved. Twins are skipped, never doubled.
 */
export class CreateProductsUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly products: ProductRepository,
    ) {}

    async execute(input: CreateProductsInput): Promise<CreatedProducts> {
        if (input.items.length === 0 || input.items.length > MAX_PRODUCTS_AT_ONCE) {
            throw ValidationError.fromField(
                "items",
                `From 1 to ${MAX_PRODUCTS_AT_ONCE} products`,
                input.items.length,
            )
        }
        await requireOwnedBusiness(this.businesses, input.businessId, input.actorTelegramId)
        const taken = new Set((await this.products.namesOf(input.businessId)).map(sameName))
        const fresh: Product[] = []
        const skipped: string[] = []
        for (const item of input.items) {
            const key = sameName(item.name)
            if (taken.has(key)) {
                skipped.push(item.name.trim())
                continue
            }
            taken.add(key)
            fresh.push(
                Product.create({ ...item, id: crypto.randomUUID(), businessId: input.businessId }),
            )
        }
        if (fresh.length > 0) {
            await this.products.saveMany(fresh)
        }
        return { created: fresh.map(toProductDTO), skipped }
    }
}

export interface UpdateProductInput {
    actorTelegramId: number
    businessId: string
    productId: string
    patch: ProductPatch & {
        isAvailable?: boolean
        /** "Sold out today": back on sale after the next local midnight. */
        stopForToday?: boolean
        imageKey?: string | null
    }
}

export class UpdateProductUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly products: ProductRepository,
        private readonly clock: Clock,
    ) {}

    async execute(input: UpdateProductInput): Promise<ProductDTO> {
        const product = await requireOwnedProduct(this.businesses, this.products, input)
        const { isAvailable, stopForToday, imageKey, ...fields } = input.patch
        product.update(fields)
        if (isAvailable !== undefined) {
            product.setAvailability(isAvailable)
        }
        if (stopForToday) {
            product.stopForToday(this.clock.now())
        }
        if (imageKey !== undefined) {
            product.setImage(imageKey)
        }
        await this.products.save(product)
        return toProductDTO(product)
    }
}

export interface DeleteProductInput {
    actorTelegramId: number
    businessId: string
    productId: string
}

/** Returns the deleted product so the adapter can remove its image. */
export class DeleteProductUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly products: ProductRepository,
    ) {}

    async execute(input: DeleteProductInput): Promise<ProductDTO> {
        const product = await requireOwnedProduct(this.businesses, this.products, input)
        await this.products.delete(product.id)
        return toProductDTO(product)
    }
}

export interface ListProductsInput {
    businessId: string
    /** Customers see only available products of an active shop. Owners see everything. */
    audience: "customer" | "owner"
    actorTelegramId: number
    category?: string
    page?: number
    limit?: number
}

export class ListProductsUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly products: ProductRepository,
        private readonly clock: Clock,
    ) {}

    async execute(input: ListProductsInput): Promise<Page<ProductDTO>> {
        if (input.audience === "owner") {
            await requireOwnedBusiness(this.businesses, input.businessId, input.actorTelegramId)
        } else {
            const business = await requireBusiness(this.businesses, input.businessId)
            if (!business.isVisibleTo(input.actorTelegramId)) {
                throw EntityNotFoundError.business(input.businessId)
            }
        }
        const page = await this.products.list(
            input.businessId,
            {
                availableAt: input.audience === "customer" ? this.clock.now() : undefined,
                category:
                    input.category === undefined
                        ? undefined
                        : requireOneOf("category", input.category, CATEGORIES),
            },
            normalizePage(input),
        )
        return mapPage(page, toProductDTO)
    }
}

async function requireOwnedProduct(
    businesses: BusinessRepository,
    products: ProductRepository,
    input: { actorTelegramId: number; businessId: string; productId: string },
): Promise<Product> {
    await requireOwnedBusiness(businesses, input.businessId, input.actorTelegramId)
    const product = await products.findById(input.productId)
    if (!product || !product.belongsTo(input.businessId)) {
        throw EntityNotFoundError.product(input.productId)
    }
    return product
}

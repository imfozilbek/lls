import type { Product } from "../../domain/entities/product.js"
import type { Category } from "../../domain/enums/category.js"
import type { Page, PageRequest } from "../dtos/pagination.js"

export interface ProductListQuery {
    /** Only products on sale at this moment (not hidden, not on today's stop-list). */
    availableAt?: Date
    category?: Category
}

export interface ShowcaseSearch {
    /** Words in search spelling (`searchWords`); every word must appear. Empty = no text filter. */
    words: readonly string[]
    category?: Category
    /** Only products on sale at this moment. */
    availableAt: Date
}

export interface ProductRepository {
    findById(id: string): Promise<Product | null>
    /** Products of this shop with the given ids. Missing or foreign ids are simply not returned. */
    findByIds(businessId: string, ids: readonly string[]): Promise<Product[]>
    /** Sorted by position, then name. */
    list(businessId: string, query: ProductListQuery, page: PageRequest): Promise<Page<Product>>
    /**
     * Products across every shop in the LLS showcase (active, with a marketplace deal).
     * Sorted by name.
     */
    searchShowcase(search: ShowcaseSearch, page: PageRequest): Promise<Page<Product>>
    save(product: Product): Promise<void>
    delete(id: string): Promise<void>
}

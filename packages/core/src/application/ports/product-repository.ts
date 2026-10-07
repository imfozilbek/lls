import type { Product } from "../../domain/entities/product.js"
import type { Category } from "../../domain/enums/category.js"
import type { Page, PageRequest } from "../dtos/pagination.js"

export interface ProductListQuery {
    /** Only products on sale at this moment (not hidden, not on today's stop-list). */
    availableAt?: Date
    category?: Category
}

export interface ShowcaseSearch {
    /**
     * Words in search spelling (`searchWords`); each must start a word of the product text.
     * Empty = no text filter.
     */
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
     * Products across every shop in the Zumda showcase (active, with a marketplace deal).
     * Sorted by name.
     */
    searchShowcase(search: ShowcaseSearch, page: PageRequest): Promise<Page<Product>>
    /** The names of every product of the shop (hidden ones too): to keep a list without twins. */
    namesOf(businessId: string): Promise<string[]>
    save(product: Product): Promise<void>
    /** Several new products at once, all or none (one transaction). */
    saveMany(products: readonly Product[]): Promise<void>
    delete(id: string): Promise<void>
    /** Every product of the shop gives way to these, in one transaction (a demo starts again). */
    replaceAll(businessId: string, products: readonly Product[]): Promise<void>
}

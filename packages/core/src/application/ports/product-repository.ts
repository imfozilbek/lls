import { Product } from "../../domain/entities/product.js"

export interface ProductRepository {
    findById(id: string): Promise<Product | null>
    findByBusinessId(businessId: string): Promise<Product[]>
    findAvailableByBusinessId(businessId: string): Promise<Product[]>
    findByCategory(businessId: string, category: string): Promise<Product[]>
    save(product: Product): Promise<void>
    delete(id: string): Promise<void>
}

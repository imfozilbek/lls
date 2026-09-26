import { CATEGORIES, Money, Product, UNITS, offsetOf } from "@lls/core"

import { bool, flag, oneOf, optional, placeholders } from "./rows.js"

import type { Page, PageRequest, ProductListQuery, ProductRepository } from "@lls/core"

interface ProductRow {
    id: string
    business_id: string
    name: string
    description: string | null
    price: number
    unit: string
    category: string
    image_key: string | null
    is_available: number
    position: number
    created_at: number
    updated_at: number
}

const COLUMNS = `id, business_id, name, description, price, unit, category, image_key,
    is_available, position, created_at, updated_at`

function toProduct(row: ProductRow): Product {
    return Product.reconstitute({
        id: row.id,
        businessId: row.business_id,
        name: row.name,
        description: optional(row.description),
        price: Money.of(row.price),
        unit: oneOf(row.unit, UNITS, "unit"),
        category: oneOf(row.category, CATEGORIES, "category"),
        imageKey: optional(row.image_key),
        isAvailable: bool(row.is_available),
        position: row.position,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    })
}

export class D1ProductRepository implements ProductRepository {
    constructor(private readonly db: D1Database) {}

    async findById(id: string): Promise<Product | null> {
        const row = await this.db
            .prepare(`SELECT ${COLUMNS} FROM products WHERE id = ?`)
            .bind(id)
            .first<ProductRow>()
        return row ? toProduct(row) : null
    }

    async findByIds(businessId: string, ids: readonly string[]): Promise<Product[]> {
        if (ids.length === 0) {
            return []
        }
        const { results } = await this.db
            .prepare(
                `SELECT ${COLUMNS} FROM products
                 WHERE business_id = ? AND id IN (${placeholders(ids.length)})`,
            )
            .bind(businessId, ...ids)
            .all<ProductRow>()
        return results.map(toProduct)
    }

    async list(
        businessId: string,
        query: ProductListQuery,
        page: PageRequest,
    ): Promise<Page<Product>> {
        const conditions = ["business_id = ?"]
        const params: (string | number)[] = [businessId]
        if (query.availableOnly) {
            conditions.push("is_available = 1")
        }
        if (query.category !== undefined) {
            conditions.push("category = ?")
            params.push(query.category)
        }
        const where = conditions.join(" AND ")
        const [rows, count] = await this.db.batch([
            this.db
                .prepare(
                    `SELECT ${COLUMNS} FROM products WHERE ${where}
                     ORDER BY position, name LIMIT ? OFFSET ?`,
                )
                .bind(...params, page.limit, offsetOf(page)),
            this.db
                .prepare(`SELECT COUNT(*) AS total FROM products WHERE ${where}`)
                .bind(...params),
        ])
        const total = (count?.results[0] as { total: number } | undefined)?.total ?? 0
        return {
            data: ((rows?.results ?? []) as ProductRow[]).map(toProduct),
            meta: { page: page.page, limit: page.limit, total },
        }
    }

    async save(product: Product): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO products (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (id) DO UPDATE SET name = excluded.name,
                    description = excluded.description, price = excluded.price,
                    unit = excluded.unit, category = excluded.category,
                    image_key = excluded.image_key, is_available = excluded.is_available,
                    position = excluded.position, updated_at = excluded.updated_at`,
            )
            .bind(
                product.id,
                product.businessId,
                product.name,
                product.description ?? null,
                product.price.amount,
                product.unit,
                product.category,
                product.imageKey ?? null,
                flag(product.isAvailable),
                product.position,
                product.createdAt.getTime(),
                product.updatedAt.getTime(),
            )
            .run()
    }

    async delete(id: string): Promise<void> {
        await this.db.prepare("DELETE FROM products WHERE id = ?").bind(id).run()
    }
}

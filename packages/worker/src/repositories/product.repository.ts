import {
    BusinessStatus,
    CATEGORIES,
    Money,
    Product,
    ProductOptions,
    UNITS,
    offsetOf,
} from "@zumda/core"

import { bool, flag, oneOf, optional, placeholders } from "./rows.js"

import type {
    Page,
    PageRequest,
    ProductListQuery,
    ProductRepository,
    ShowcaseSearch,
} from "@zumda/core"

interface ProductRow {
    id: string
    business_id: string
    name: string
    description: string | null
    price: number
    unit: string
    step: number
    category: string
    image_key: string | null
    is_available: number
    unavailable_until: number | null
    returnable: number
    position: number
    created_at: number
    updated_at: number
    options: string | null
}

const COLUMNS = `id, business_id, name, description, price, unit, step, category, image_key,
    is_available, unavailable_until, returnable, position, created_at, updated_at, options`

/** The same columns read through the `p` alias of a join. */
const JOINED_COLUMNS = COLUMNS.split(",")
    .map((column) => `p.${column.trim()}`)
    .join(", ")

/** Enough for any real query, and far below D1's limit of bound parameters. */
const MAX_SEARCH_WORDS = 6

/** Words hold only [a-z0-9] (core searchText): every word starting with `prefix` sorts below this. */
const AFTER_WORDS = "~"

/** A word starts with `prefix`: binds for `word >= ? AND word < ?`. */
function wordRange(prefix: string): [string, string] {
    return [prefix, `${prefix}${AFTER_WORDS}`]
}

/**
 * Showcase search driven by its first word (CROSS JOIN keeps that order): only the products that
 * match are read, never every product of every showcase shop. Binds: the word's range first.
 */
export const SHOWCASE_BY_WORD_FROM = `FROM (
        SELECT DISTINCT product_id FROM product_words WHERE word >= ? AND word < ?
    ) AS m
    CROSS JOIN products p ON p.id = m.product_id
    CROSS JOIN businesses b ON b.id = p.business_id`

/** Every further word of the search; binds: its range. */
export const WORD_FILTER =
    "p.id IN (SELECT product_id FROM product_words WHERE word >= ? AND word < ?)"

/** The distinct words of a product's search text. */
function wordsOf(text: string): string[] {
    return [...new Set(text.split(" ").filter((word) => word.length > 0))]
}

function toProduct(row: ProductRow): Product {
    return Product.reconstitute({
        id: row.id,
        businessId: row.business_id,
        name: row.name,
        description: optional(row.description),
        price: Money.of(row.price),
        unit: oneOf(row.unit, UNITS, "unit"),
        step: row.step,
        category: oneOf(row.category, CATEGORIES, "category"),
        imageKey: optional(row.image_key),
        isAvailable: bool(row.is_available),
        unavailableUntil:
            row.unavailable_until === null ? undefined : new Date(row.unavailable_until),
        returnable: bool(row.returnable),
        position: row.position,
        options: row.options === null ? undefined : ProductOptions.create(JSON.parse(row.options)),
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
        if (query.availableAt !== undefined) {
            conditions.push(
                "is_available = 1 AND (unavailable_until IS NULL OR unavailable_until <= ?)",
            )
            params.push(query.availableAt.getTime())
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

    async searchShowcase(search: ShowcaseSearch, page: PageRequest): Promise<Page<Product>> {
        const words = search.words.slice(0, MAX_SEARCH_WORDS)
        const conditions = [
            "b.status = ?",
            "b.marketplace_commission_bps IS NOT NULL",
            "p.is_available = 1",
            "(p.unavailable_until IS NULL OR p.unavailable_until <= ?)",
        ]
        const params: (string | number)[] = []
        const [first, ...rest] = words
        // The first word drives the read (its prefix range in product_words); the other words
        // only filter what it found. Without words (a category alone): the showcase's products.
        const from =
            first === undefined
                ? "FROM products p JOIN businesses b ON b.id = p.business_id"
                : SHOWCASE_BY_WORD_FROM
        if (first !== undefined) {
            params.push(...wordRange(first))
        }
        params.push(BusinessStatus.ACTIVE, search.availableAt.getTime())
        if (search.category !== undefined) {
            conditions.push("p.category = ?")
            params.push(search.category)
        }
        for (const word of rest) {
            conditions.push(WORD_FILTER)
            params.push(...wordRange(word))
        }
        const query = `${from} WHERE ${conditions.join(" AND ")}`
        // One read instead of two: the window function counts while the page is read.
        const { results } = await this.db
            .prepare(
                `SELECT ${JOINED_COLUMNS}, COUNT(*) OVER () AS total ${query}
                 ORDER BY p.name LIMIT ? OFFSET ?`,
            )
            .bind(...params, page.limit, offsetOf(page))
            .all<ProductRow & { total: number }>()
        const total =
            results[0]?.total ?? (offsetOf(page) > 0 ? await this.count(query, params) : 0)
        return {
            data: results.map(toProduct),
            meta: { page: page.page, limit: page.limit, total },
        }
    }

    /** Only for a page past the end: the window count above has no row to ride on. */
    private async count(query: string, params: (string | number)[]): Promise<number> {
        const row = await this.db
            .prepare(`SELECT COUNT(*) AS total ${query}`)
            .bind(...params)
            .first<{ total: number }>()
        return row?.total ?? 0
    }

    async save(product: Product): Promise<void> {
        const upsert = this.db
            .prepare(
                `INSERT INTO products (${COLUMNS}, search_text)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (id) DO UPDATE SET name = excluded.name,
                    search_text = excluded.search_text,
                    description = excluded.description, price = excluded.price,
                    unit = excluded.unit, step = excluded.step, category = excluded.category,
                    image_key = excluded.image_key, is_available = excluded.is_available,
                    unavailable_until = excluded.unavailable_until,
                    returnable = excluded.returnable, position = excluded.position,
                    options = excluded.options, updated_at = excluded.updated_at`,
            )
            .bind(
                product.id,
                product.businessId,
                product.name,
                product.description ?? null,
                product.price.amount,
                product.unit,
                product.step,
                product.category,
                product.imageKey ?? null,
                flag(product.isAvailable),
                product.unavailableUntil?.getTime() ?? null,
                flag(product.returnable),
                product.position,
                product.createdAt.getTime(),
                product.updatedAt.getTime(),
                product.options ? JSON.stringify(product.options.toJSON()) : null,
                ` ${product.searchText}`,
            )
        // The product and its words change together (one batch is one transaction).
        await this.db.batch([
            upsert,
            this.db.prepare("DELETE FROM product_words WHERE product_id = ?").bind(product.id),
            ...wordsOf(product.searchText).map((word) =>
                this.db
                    .prepare("INSERT OR IGNORE INTO product_words (word, product_id) VALUES (?, ?)")
                    .bind(word, product.id),
            ),
        ])
    }

    async delete(id: string): Promise<void> {
        await this.db.batch([
            this.db.prepare("DELETE FROM product_words WHERE product_id = ?").bind(id),
            this.db.prepare("DELETE FROM products WHERE id = ?").bind(id),
        ])
    }
}

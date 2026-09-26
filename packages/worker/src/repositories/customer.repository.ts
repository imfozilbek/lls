import { Customer, LANGUAGES, Phone, TelegramId } from "@lls/core"

import { oneOf } from "./rows.js"

import type { CustomerRepository } from "@lls/core"

interface CustomerRow {
    id: string
    telegram_id: number
    name: string
    phone: string | null
    language: string
    created_at: number
    updated_at: number
}

const COLUMNS = "id, telegram_id, name, phone, language, created_at, updated_at"

function toCustomer(row: CustomerRow): Customer {
    return Customer.reconstitute({
        id: row.id,
        telegramId: TelegramId.create(row.telegram_id),
        name: row.name,
        phone: row.phone === null ? undefined : Phone.create(row.phone),
        language: oneOf(row.language, LANGUAGES, "language"),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    })
}

export class D1CustomerRepository implements CustomerRepository {
    constructor(private readonly db: D1Database) {}

    async findById(id: string): Promise<Customer | null> {
        return this.findOne("id = ?", id)
    }

    async findByTelegramId(telegramId: number): Promise<Customer | null> {
        return this.findOne("telegram_id = ?", telegramId)
    }

    async save(customer: Customer): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO customers (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (id) DO UPDATE SET name = excluded.name, phone = excluded.phone,
                    language = excluded.language, updated_at = excluded.updated_at`,
            )
            .bind(
                customer.id,
                customer.telegramId.value,
                customer.name,
                customer.phone?.number ?? null,
                customer.language,
                customer.createdAt.getTime(),
                customer.updatedAt.getTime(),
            )
            .run()
    }

    async linkToBusiness(customerId: string, businessId: string, at: Date): Promise<void> {
        await this.db
            .prepare(
                `INSERT OR IGNORE INTO customer_businesses (customer_id, business_id, first_order_at)
                 VALUES (?, ?, ?)`,
            )
            .bind(customerId, businessId, at.getTime())
            .run()
    }

    private async findOne(where: string, value: string | number): Promise<Customer | null> {
        const row = await this.db
            .prepare(`SELECT ${COLUMNS} FROM customers WHERE ${where}`)
            .bind(value)
            .first<CustomerRow>()
        return row ? toCustomer(row) : null
    }
}

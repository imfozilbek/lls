/**
 * Fills the LOCAL D1 with three demo shops (food, water, grocery), their catalogs and one
 * courier, so `wrangler dev` + the Mini App work without Telegram or Cloudflare accounts.
 * Creates `.dev.vars` on the first run.
 *
 *   bun run seed:dev
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { encryptSecret } from "../src/crypto.js"

import { DEV_ADMIN_ID, DEV_COURIER, DEV_SHOPS } from "./dev-fixtures.js"

import type { DevShop } from "./dev-fixtures.js"

const ROOT = join(import.meta.dirname, "..")
const DEV_VARS = join(ROOT, ".dev.vars")

interface DemoProduct {
    name: string
    price: number
    unit: string
    category: string
    /** Grams for kg items. */
    step?: number
    returnable?: boolean
}

const item = (
    name: string,
    price: number,
    unit: string,
    category: string,
    extra: Partial<DemoProduct> = {},
): DemoProduct => ({ name, price, unit, category, ...extra })

const CATALOGS: Record<DevShop["type"], readonly DemoProduct[]> = {
    food: [
        item("To'y oshi", 45_000, "portion", "meals"),
        item("Lag'mon", 38_000, "portion", "soups"),
        item("Shashlik (mol go'shti)", 22_000, "pcs", "grill"),
        item("Achchiq-chuchuk", 12_000, "portion", "salads"),
        item("Somsa tandir", 8_000, "pcs", "bakery"),
        item("Kompot 1 l", 15_000, "l", "drinks"),
    ],
    water: [
        item("Toza suv 19 l", 15_000, "bottle_19l", "water", { returnable: true }),
        item("Mineral suv 1,5 l", 6_000, "pcs", "water"),
        item("Kuler uchun pompa", 45_000, "pcs", "other"),
    ],
    grocery: [
        item("Pomidor", 12_000, "kg", "produce", { step: 500 }),
        item("Kartoshka", 6_000, "kg", "produce", { step: 1000 }),
        item("Mol go'shti", 95_000, "kg", "meat", { step: 250 }),
        item("Sut 1 l", 11_000, "pcs", "dairy"),
        item("Non", 4_000, "pcs", "bakery"),
        item("Guruch (lazer)", 18_000, "kg", "groceries", { step: 1000 }),
    ],
}

const FEATURES: Record<DevShop["type"], string[]> = {
    food: ["reorder", "stopList"],
    water: ["reorder", "bottleDeposit"],
    grocery: ["reorder", "weightItems", "stopList"],
}

const BOTTLE_DEPOSIT = 30_000

/** Minimum order per kind of shop; one bottle of water is a normal order. */
const MIN_ORDER: Record<DevShop["type"], number | null> = {
    food: 40_000,
    water: null,
    grocery: 15_000,
}

function randomBase64(bytes: number): string {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64")
}

/** Reads `.dev.vars`, creating it with fresh local-only secrets when missing. */
function devVars(): Record<string, string> {
    if (!existsSync(DEV_VARS)) {
        const lines = [
            `TOKEN_ENC_KEY="${randomBase64(32)}"`,
            `PLATFORM_BOT_TOKEN="100200999:DEV-platform-token-not-a-real-bot-x"`,
            `PLATFORM_WEBHOOK_SECRET="dev-platform-secret"`,
            `PLATFORM_ADMIN_IDS="${DEV_ADMIN_ID}"`,
        ]
        writeFileSync(DEV_VARS, `${lines.join("\n")}\n`)
        console.warn("Created .dev.vars with local-only secrets")
    }
    const vars: Record<string, string> = {}
    for (const line of readFileSync(DEV_VARS, "utf8").split("\n")) {
        const match = /^([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/.exec(line)
        if (match?.[1]) {
            vars[match[1]] = match[2] ?? ""
        }
    }
    return vars
}

const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`

async function shopSql(shop: DevShop, tokenKey: string, now: number): Promise<string[]> {
    const tokenEnc = await encryptSecret(shop.bot.token, tokenKey)
    const deposit = shop.type === "water" ? BOTTLE_DEPOSIT : 0
    const products = (CATALOGS[shop.type] ?? []).map(
        (p, index) =>
            `(${quote(`${shop.id}-p${index + 1}`)}, ${quote(shop.id)}, ${quote(p.name)}, ` +
            `${p.price}, ${quote(p.unit)}, ${p.step ?? 1}, ${p.returnable ? 1 : 0}, ` +
            `${quote(p.category)}, ${index}, ${now}, ${now})`,
    )
    return [
        `INSERT INTO businesses (id, slug, name, type, owner_telegram_id, status, bot_id,
            bot_username, bot_token_enc, webhook_secret, brand_color, address, delivery_fee,
            free_delivery_from, min_order, features, bottle_deposit, created_at, updated_at)
         VALUES (${quote(shop.id)}, ${quote(shop.slug)}, ${quote(shop.name)}, ${quote(shop.type)},
            ${shop.owner.id}, 'active', ${shop.bot.id}, ${quote(shop.bot.username)},
            ${quote(tokenEnc)}, ${quote(shop.bot.webhookSecret)}, ${quote(shop.brandColor)},
            'Guliston, Mustaqillik 12', 10000, 150000, ${MIN_ORDER[shop.type] ?? "NULL"},
            ${quote(JSON.stringify(FEATURES[shop.type]))}, ${deposit}, ${now}, ${now});`,
        `INSERT INTO products (id, business_id, name, price, unit, step, returnable, category,
            position, created_at, updated_at) VALUES ${products.join(",\n")};`,
        `INSERT INTO couriers (id, business_id, telegram_id, name, phone, is_active, created_at,
            updated_at) VALUES (${quote(`${shop.id}-courier`)}, ${quote(shop.id)},
            ${DEV_COURIER.id}, ${quote(DEV_COURIER.first_name)}, '+998901112233', 1, ${now},
            ${now});`,
    ]
}

async function seedSql(tokenKey: string): Promise<string> {
    const now = Date.now()
    const shops = await Promise.all(DEV_SHOPS.map((shop) => shopSql(shop, tokenKey, now)))
    return [
        "DELETE FROM order_items;",
        "DELETE FROM orders;",
        "DELETE FROM courier_invites;",
        "DELETE FROM couriers;",
        "DELETE FROM customer_businesses;",
        "DELETE FROM customers;",
        "DELETE FROM products;",
        "DELETE FROM businesses;",
        ...shops.flat(),
    ].join("\n")
}

async function main(): Promise<void> {
    const vars = devVars()
    const key = vars["TOKEN_ENC_KEY"]
    if (!key) {
        throw new Error(".dev.vars has no TOKEN_ENC_KEY")
    }
    const file = join(mkdtempSync(join(tmpdir(), "lls-seed-")), "seed.sql")
    writeFileSync(file, await seedSql(key))
    const wrangler = ["wrangler", "d1"]
    const cwd = { cwd: ROOT, stdio: "inherit" } as const
    execFileSync("bunx", [...wrangler, "migrations", "apply", "lls", "--local"], cwd)
    execFileSync("bunx", [...wrangler, "execute", "lls", "--local", `--file=${file}`], cwd)
    for (const shop of DEV_SHOPS) {
        console.warn(`Seeded ${shop.type} shop: open the app with ?shop=${shop.slug}`)
    }
}

main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
})

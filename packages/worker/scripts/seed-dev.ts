/**
 * Fills the LOCAL D1 with a demo shop and menu, so `wrangler dev` + the Mini App work
 * without Telegram or Cloudflare accounts. Creates `.dev.vars` on the first run.
 *
 *   bun run seed:dev
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { encryptSecret } from "../src/crypto.js"

import { DEV_ADMIN_ID, DEV_BOT, DEV_OWNER, DEV_SHOP_SLUG } from "./dev-fixtures.js"

const ROOT = join(import.meta.dirname, "..")
const DEV_VARS = join(ROOT, ".dev.vars")
const SHOP_ID = "dev-shop"

const MENU: readonly [string, number, string, string][] = [
    ["To'y oshi", 45_000, "portion", "meals"],
    ["Lag'mon", 38_000, "portion", "soups"],
    ["Shashlik (mol go'shti)", 22_000, "pcs", "grill"],
    ["Achchiq-chuchuk", 12_000, "portion", "salads"],
    ["Somsa tandir", 8_000, "pcs", "bakery"],
    ["Kompot 1 l", 15_000, "l", "drinks"],
]

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

async function seedSql(tokenKey: string): Promise<string> {
    const now = Date.now()
    const tokenEnc = await encryptSecret(DEV_BOT.token, tokenKey)
    const products = MENU.map(
        ([name, price, unit, category], index) =>
            `(${quote(`dev-p${index + 1}`)}, ${quote(SHOP_ID)}, ${quote(name)}, ${price}, ` +
            `${quote(unit)}, ${quote(category)}, ${index}, ${now}, ${now})`,
    )
    return [
        "DELETE FROM order_items;",
        "DELETE FROM orders;",
        "DELETE FROM customer_businesses;",
        "DELETE FROM customers;",
        "DELETE FROM products;",
        "DELETE FROM businesses;",
        `INSERT INTO businesses (id, slug, name, type, owner_telegram_id, status, bot_id,
            bot_username, bot_token_enc, webhook_secret, brand_color, address, delivery_fee,
            free_delivery_from, min_order, created_at, updated_at)
         VALUES (${quote(SHOP_ID)}, ${quote(DEV_SHOP_SLUG)}, 'Osh Markaz', 'food', ${DEV_OWNER.id},
            'active', ${DEV_BOT.id}, ${quote(DEV_BOT.username)}, ${quote(tokenEnc)},
            ${quote(DEV_BOT.webhookSecret)}, '#d97706', 'Guliston, Mustaqillik 12', 10000,
            150000, 40000, ${now}, ${now});`,
        `INSERT INTO products (id, business_id, name, price, unit, category, position,
            created_at, updated_at) VALUES ${products.join(",\n")};`,
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
    console.warn(`Seeded shop "${DEV_SHOP_SLUG}". Open the app with ?shop=${DEV_SHOP_SLUG}`)
}

main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
})

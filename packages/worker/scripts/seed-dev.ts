/**
 * Fills the LOCAL D1 with a demo shop of every kind (food, water, grocery, service, store), each
 * ready to work (card, hours, phone, logo, products, courier), so `wrangler dev` + the Mini App
 * work without Telegram or Cloudflare accounts. The logos go to the local R2. Creates `.dev.vars`
 * on the first run.
 *
 *   bun run seed:dev
 *
 * `ZUMDA_PERSIST_TO=<dir>` keeps this data in a separate local state (the e2e stand uses it).
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { searchText } from "@zumda/core"

import { encryptSecret } from "../src/crypto.js"

import {
    DEV_ADMIN_ID,
    DEV_BUSINESS_BOT,
    DEV_COURIER,
    DEV_COURIER_BOT,
    DEV_DISTRICT,
    DEV_NETWORK_COURIERS,
    DEV_SHOPS,
    typeOf,
} from "./dev-fixtures.js"

import type { DevShop } from "./dev-fixtures.js"

const ROOT = join(import.meta.dirname, "..")
const DEV_VARS = join(ROOT, ".dev.vars")
const DAY_MS = 24 * 60 * 60 * 1000

interface DemoOption {
    id: string
    name: string
    price: number
}

interface DemoProduct {
    name: string
    price: number
    unit: string
    category: string
    /** Grams for weight units (kg, 100 g). */
    step?: number
    returnable?: boolean
    description?: string
    /** Sizes (one is picked, the product costs as the cheapest) and add-ons (on top). */
    options?: { group?: string; variants: DemoOption[]; addons: DemoOption[] }
}

const item = (
    name: string,
    price: number,
    unit: string,
    category: string,
    extra: Partial<DemoProduct> = {},
): DemoProduct => ({ name, price, unit, category, ...extra })

/** Variants or add-ons of a demo product: ids are short and stable, like the app makes them. */
const options = (
    group: string,
    variants: [string, number][],
    addons: [string, number][] = [],
): DemoProduct["options"] => ({
    group,
    variants: variants.map(([name, price], index) => ({ id: `v${index + 1}`, name, price })),
    addons: addons.map(([name, price], index) => ({ id: `a${index + 1}`, name, price })),
})

/**
 * Each shop's catalog. The first items are the ones the e2e specs order (`dev-<shop>-p1`...):
 * new demo items go at the end, never in between.
 */
const CATALOGS: Record<DevShop["kind"], readonly DemoProduct[]> = {
    food: [
        item("To'y oshi", 45_000, "portion", "meals", {
            description: "Devzira guruch, mol go'shti, sabzi va no'xat: qozonda, o'tinda.",
        }),
        item("Lag'mon", 38_000, "portion", "soups"),
        item("Shashlik (mol go'shti)", 22_000, "pcs", "grill"),
        item("Achchiq-chuchuk", 12_000, "portion", "salads"),
        item("Somsa tandir", 8_000, "pcs", "bakery"),
        item("Kompot 1 l", 15_000, "l", "drinks"),
        item("Choyxona oshi", 25_000, "portion", "osh", {
            description: "Kunduzgi osh: porsiyasini tanlang, qazi va bedana tuxumi bilan.",
            options: options(
                "Porsiya",
                [
                    ["0,5 porsiya", 25_000],
                    ["0,7 porsiya", 32_000],
                    ["1 porsiya", 42_000],
                ],
                [
                    ["Qazi", 15_000],
                    ["Bedana tuxumi", 5_000],
                ],
            ),
        }),
        item("Xonim", 28_000, "portion", "meals", {
            description: "Bug'da pishgan, kartoshka va go'sht bilan, qatiq bilan.",
        }),
        item("Ko'k choy (choynak)", 5_000, "pcs", "hot_drinks"),
    ],
    water: [
        item("Toza suv 19 l", 15_000, "bottle_19l", "water", {
            returnable: true,
            description: "Bo'sh idishni qaytarsangiz, garov olinmaydi.",
        }),
        item("Mineral suv 1,5 l", 6_000, "pcs", "water"),
        item("Kuler uchun pompa", 45_000, "pcs", "other"),
        item("Toza suv 5 l", 8_000, "pcs", "water"),
    ],
    grocery: [
        item("Pomidor", 12_000, "kg", "produce", { step: 500 }),
        item("Kartoshka", 6_000, "kg", "produce", { step: 1000 }),
        item("Mol go'shti", 95_000, "kg", "meat", { step: 250 }),
        item("Sut 1 l", 11_000, "pcs", "dairy"),
        item("Non", 4_000, "pcs", "bakery"),
        item("Guruch (lazer)", 18_000, "kg", "groceries", { step: 1000 }),
        item("Zira", 6_000, "g100", "spices", {
            step: 100,
            description: "Osh uchun: 100 grammdan tortib beramiz.",
        }),
        item("Tuxum (10 dona)", 16_000, "pack", "eggs"),
        item("Olma", 14_000, "kg", "produce", { step: 500 }),
    ],
    service: [
        item("Gilam yuvish (kv. metr)", 12_000, "pcs", "cleaning"),
        item("Avtomobil yuvish", 60_000, "pcs", "car_care"),
        item("Divan tozalash", 150_000, "pcs", "cleaning"),
        item("Ko'rpa yuvish", 40_000, "pcs", "laundry", {
            description: "Olib ketamiz va 2-3 kunda quritib qaytaramiz.",
        }),
        item("Salonni kimyoviy tozalash", 250_000, "pcs", "car_care", {
            options: options("Mashina", [
                ["Sedan", 250_000],
                ["Krossover", 320_000],
                ["Jip", 400_000],
            ]),
        }),
        item("Parda yuvish", 20_000, "pcs", "cleaning"),
    ],
    store: [
        item("Kir yuvish kukuni 3 kg", 65_000, "pack", "chemicals"),
        item("Idish yuvish vositasi 1 l", 18_000, "pcs", "chemicals"),
        item("LED lampochka", 12_000, "pcs", "electrical", {
            description: "E27 patron, iliq yoki oq nur.",
            options: options("Quvvati", [
                ["9 W", 12_000],
                ["12 W", 15_000],
                ["15 W", 19_000],
            ]),
        }),
        item("Chinni choynak", 55_000, "pcs", "kitchenware"),
        item("Ish qo'lqopi", 8_000, "pair", "tools"),
        item("Elektr kabeli 2x1,5", 7_000, "m", "electrical", {
            description: "Mis sim: kerakli uzunlikda kesib beramiz.",
        }),
    ],
}

const FEATURES: Record<DevShop["kind"], string[]> = {
    food: ["reorder", "stopList"],
    water: ["reorder", "bottleDeposit"],
    grocery: ["reorder", "weightItems", "stopList"],
    service: ["reorder"],
    store: ["reorder"],
}

const BOTTLE_DEPOSIT = 30_000

/** Showcase deals (basis points): food and grocery are in the Zumda showcase, water is not. */
const SHOWCASE_BPS: Record<DevShop["kind"], number | null> = {
    food: 500,
    water: null,
    grocery: 300,
    service: null,
    store: 300,
}

/** Demo cards for transfers (valid checksums, not real accounts): customers pay only by transfer. */
const PAYOUT_CARDS: Record<DevShop["kind"], [string, string] | null> = {
    food: ["8600123456789012", "RUSTAM KARIMOV"], // secret-scan: fake
    water: ["9860123456789015", "DILSHOD TOSHEV"], // secret-scan: fake
    grocery: ["5614681234567893", "SARDOR YUSUPOV"], // secret-scan: fake
    service: ["4111111111111111", "JASUR NORMATOV"], // secret-scan: fake
    store: ["9860987654321015", "FERUZA ALIYEVA"], // secret-scan: fake
}

/** How customers pay: the store takes both, so the stand has a shop with cash at the door. */
const PAYMENT_OPTIONS: Record<DevShop["kind"], "card" | "cash" | "both"> = {
    food: "card",
    water: "card",
    grocery: "card",
    service: "card",
    store: "both",
}

/**
 * Open the whole day, every day (`00:00` to `00:00`): the step «Ish vaqti» is done and the stand
 * never finds a shop closed, whatever the hour the specs run.
 */
const ALL_DAY = JSON.stringify(
    Object.fromEntries(
        ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => [
            day,
            { open: "00:00", close: "00:00" },
        ]),
    ),
)

/** Each shop's logo: drawn once (`demo-logos/<id>.png`), put into the local R2 on every seed. */
const LOGOS_DIR = join(import.meta.dirname, "demo-logos")
const logoKey = (shop: DevShop): string => `shops/${shop.id}/logo/demo.png`

/** Minimum order per kind of shop; one bottle of water is a normal order. */
const MIN_ORDER: Record<DevShop["kind"], number | null> = {
    food: 40_000,
    water: null,
    grocery: 15_000,
    service: null,
    store: 20_000,
}

function randomBase64(bytes: number): string {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64")
}

/** Local-only values; a missing key is added to an existing `.dev.vars`, others stay. */
function defaultDevVars(): Record<string, string> {
    return {
        TOKEN_ENC_KEY: randomBase64(32),
        PLATFORM_BOT_TOKEN: "100200999:DEV-platform-token-not-a-real-bot-x",
        PLATFORM_WEBHOOK_SECRET: "dev-platform-secret",
        PLATFORM_ADMIN_IDS: String(DEV_ADMIN_ID),
        COURIER_BOT_TOKEN: DEV_COURIER_BOT.token,
        COURIER_WEBHOOK_SECRET: DEV_COURIER_BOT.webhookSecret,
        BUSINESS_BOT_TOKEN: DEV_BUSINESS_BOT.token,
        BUSINESS_WEBHOOK_SECRET: DEV_BUSINESS_BOT.webhookSecret,
        BUSINESS_SESSION_SECRET: "dev-business-session-secret",
    }
}

/** Reads `.dev.vars`, creating it (or adding missing keys) with local-only secrets. */
function devVars(): Record<string, string> {
    const current = existsSync(DEV_VARS) ? readFileSync(DEV_VARS, "utf8") : ""
    const missing = Object.entries(defaultDevVars()).filter(
        ([key]) => !new RegExp(`^${key}\\s*=`, "m").test(current),
    )
    if (missing.length > 0) {
        const lines = missing.map(([key, value]) => `${key}="${value}"`)
        const separator = current === "" || current.endsWith("\n") ? "" : "\n"
        writeFileSync(DEV_VARS, `${current}${separator}${lines.join("\n")}\n`)
        console.warn(`.dev.vars: added ${missing.map(([key]) => key).join(", ")}`)
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
    const deposit = shop.kind === "water" ? BOTTLE_DEPOSIT : 0
    const card = PAYOUT_CARDS[shop.kind]
    const nullable = (value: string | undefined): string => (value ? quote(value) : "NULL")
    const products = (CATALOGS[shop.kind] ?? []).map(
        (p, index) =>
            `(${quote(`${shop.id}-p${index + 1}`)}, ${quote(shop.id)}, ${quote(p.name)}, ` +
            `${nullable(p.description)}, ${p.price}, ${quote(p.unit)}, ${p.step ?? 1}, ` +
            `${p.returnable ? 1 : 0}, ${quote(p.category)}, ` +
            `${quote(` ${searchText(p.name, p.description)}`)}, ` +
            `${nullable(p.options && JSON.stringify(p.options))}, ${index}, ${now}, ${now})`,
    )
    // The showcase search reads these (the repository writes them on every save).
    const words = (CATALOGS[shop.kind] ?? []).flatMap((p, index) =>
        [...new Set(searchText(p.name, p.description).split(" "))]
            .filter((word) => word.length > 0)
            .map((word) => `(${quote(word)}, ${quote(`${shop.id}-p${index + 1}`)})`),
    )
    return [
        `INSERT INTO businesses (id, slug, name, type, owner_telegram_id, status, bot_id,
            bot_username, bot_token_enc, webhook_secret, brand_color, address, latitude, longitude,
            district_id, delivery_fee,
            free_delivery_from, min_order, features, bottle_deposit, marketplace_commission_bps,
            marketplace_joined_at, payout_card_number, payout_card_holder, payment_card_id,
            payment_options, working_hours, contact_phone, logo_key, owner_chat_open_at,
            created_at, updated_at)
         VALUES (${quote(shop.id)}, ${quote(shop.slug)}, ${quote(shop.name)}, ${quote(typeOf(shop))},
            ${shop.owner.id}, 'active', ${shop.bot.id}, ${quote(shop.bot.username)},
            ${quote(tokenEnc)}, ${quote(shop.bot.webhookSecret)}, ${quote(shop.brandColor)},
            ${quote(shop.address)}, ${shop.location.latitude}, ${shop.location.longitude},
            ${quote(DEV_DISTRICT.id)}, 10000, 150000, ${MIN_ORDER[shop.kind] ?? "NULL"},
            ${quote(JSON.stringify(FEATURES[shop.kind]))}, ${deposit},
            ${SHOWCASE_BPS[shop.kind] ?? "NULL"}, ${SHOWCASE_BPS[shop.kind] === null ? "NULL" : now},
            ${card ? quote(card[0]) : "NULL"}, ${card ? quote(card[1]) : "NULL"},
            ${card ? quote(`${shop.id}-card`) : "NULL"}, ${quote(PAYMENT_OPTIONS[shop.kind])},
            ${quote(ALL_DAY)}, ${quote(shop.contactPhone)}, ${quote(logoKey(shop))}, ${now},
            ${now}, ${now});`,
        ...(card
            ? [
                  `INSERT INTO payout_cards (id, business_id, number, holder, created_at)
                   VALUES (${quote(`${shop.id}-card`)}, ${quote(shop.id)}, ${quote(card[0])},
                   ${quote(card[1])}, ${now});`,
              ]
            : []),
        `INSERT INTO products (id, business_id, name, description, price, unit, step, returnable,
            category, search_text, options, position, created_at, updated_at)
            VALUES ${products.join(",\n")};`,
        `INSERT INTO product_words (word, product_id) VALUES ${words.join(",\n")};`,
        `INSERT INTO couriers (id, business_id, telegram_id, name, phone, is_active, status,
            created_at, updated_at) VALUES (${quote(`${shop.id}-courier`)}, ${quote(shop.id)},
            ${DEV_COURIER.id}, ${quote(DEV_COURIER.first_name)}, '+998901112233', 1, 'active',
            ${now}, ${now});`,
    ]
}

async function seedSql(tokenKey: string): Promise<string> {
    const now = Date.now()
    const shops = await Promise.all(DEV_SHOPS.map((shop) => shopSql(shop, tokenKey, now)))
    // The demo courier works for every demo shop and is on shift for the next day.
    const courierProfile = `INSERT INTO courier_profiles (telegram_id, name, phone, shift_until,
        created_at, updated_at) VALUES (${DEV_COURIER.id}, ${quote(DEV_COURIER.first_name)},
        '+998901112233', ${now + DAY_MS}, ${now}, ${now});`
    const district = `INSERT INTO districts (id, name, name_key, latitude, longitude, radius_m,
        created_at, updated_at) VALUES (${quote(DEV_DISTRICT.id)}, ${quote(DEV_DISTRICT.name)},
        ${quote(DEV_DISTRICT.name.toLowerCase())}, ${DEV_DISTRICT.latitude}, ${DEV_DISTRICT.longitude},
        ${DEV_DISTRICT.radiusMeters}, ${now}, ${now});`
    const network = DEV_NETWORK_COURIERS.flatMap((c) => [
        `INSERT INTO courier_profiles (telegram_id, name, phone, shift_until, in_network,
            network_offered_at, created_at, updated_at) VALUES (${c.id}, ${quote(c.first_name)},
            '+99890555${String(c.id).slice(-4)}', ${now + DAY_MS}, 1, ${now}, ${now}, ${now});`,
        `INSERT INTO couriers (id, business_id, telegram_id, name, phone, is_active, status,
            created_at, updated_at) VALUES (${quote(`${c.shop}-network-${c.id}`)}, ${quote(c.shop)},
            ${c.id}, ${quote(c.first_name)}, NULL, 1, 'active', ${now}, ${now});`,
    ])
    return [
        "DELETE FROM managed_bots;",
        "DELETE FROM network_offers;",
        "DELETE FROM order_items;",
        "DELETE FROM cash_handovers;",
        "DELETE FROM orders;",
        "DELETE FROM trips;",
        "DELETE FROM courier_invites;",
        "DELETE FROM couriers;",
        "DELETE FROM courier_profiles;",
        "DELETE FROM customer_phone_shares;",
        "DELETE FROM alert_log;",
        "DELETE FROM customer_businesses;",
        "DELETE FROM customers;",
        "DELETE FROM product_words;",
        "DELETE FROM products;",
        "DELETE FROM payout_cards;",
        "DELETE FROM businesses;",
        "DELETE FROM districts;",
        district,
        ...shops.flat(),
        courierProfile,
        ...network,
    ].join("\n")
}

async function main(): Promise<void> {
    const vars = devVars()
    const key = vars["TOKEN_ENC_KEY"]
    if (!key) {
        throw new Error(".dev.vars has no TOKEN_ENC_KEY")
    }
    const file = join(mkdtempSync(join(tmpdir(), "zumda-seed-")), "seed.sql")
    writeFileSync(file, await seedSql(key))
    const wrangler = ["wrangler", "d1"]
    const persist = process.env["ZUMDA_PERSIST_TO"]
    const local = persist ? ["--local", "--persist-to", persist] : ["--local"]
    const cwd = { cwd: ROOT, stdio: "inherit" } as const
    // `--data-only`: the schema is already there (the e2e stand resets data before every spec).
    if (!process.argv.includes("--data-only")) {
        execFileSync("bunx", [...wrangler, "migrations", "apply", "zumda", ...local], cwd)
    }
    execFileSync("bunx", [...wrangler, "execute", "zumda", ...local, `--file=${file}`], cwd)
    // Every seed, in one wrangler run: a spec that replaces a logo deletes the demo file.
    const logos = join(file, "..", "logos.json")
    writeFileSync(
        logos,
        JSON.stringify(
            DEV_SHOPS.map((shop) => ({
                key: logoKey(shop),
                file: join(LOGOS_DIR, `${shop.id}.png`),
            })),
        ),
    )
    execFileSync(
        "bunx",
        [
            "wrangler",
            "r2",
            "bulk",
            "put",
            "zumda-media",
            `--filename=${logos}`,
            "--ct=image/png",
            ...local,
        ],
        cwd,
    )
    for (const shop of DEV_SHOPS) {
        console.warn(`Seeded ${shop.kind} shop: open the app with ?shop=${shop.slug}`)
    }
}

main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
})

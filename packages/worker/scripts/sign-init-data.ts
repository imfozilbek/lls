/**
 * Prints initData signed with a DEV shop bot token, like Telegram would send it.
 * For local checks with curl or a browser shim:
 *
 *   bun run init-data:dev <customer|owner|courier> [shop-slug]
 *   curl -H "X-Shop: osh-markaz-dev" -H "X-Telegram-Init-Data: $(bun run -s init-data:dev)" \
 *        http://localhost:8787/api/shop
 */
import { DEV_COURIER, DEV_CUSTOMER, devShop } from "./dev-fixtures.js"

const encoder = new TextEncoder()

async function hmac(key: Uint8Array | ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    )
    return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data))
}

export async function signInitData(user: object, botToken: string): Promise<string> {
    const params = new URLSearchParams({
        auth_date: String(Math.floor(Date.now() / 1000)),
        query_id: "AAE-dev",
        user: JSON.stringify(user),
    })
    const dataCheckString = [...params.entries()]
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join("\n")
    const secret = await hmac(encoder.encode("WebAppData"), botToken)
    const hash = Buffer.from(await hmac(secret, dataCheckString)).toString("hex")
    params.set("hash", hash)
    return params.toString()
}

const shop = devShop(process.argv[3])
const people = { owner: shop.owner, courier: DEV_COURIER, customer: DEV_CUSTOMER }
const who = people[process.argv[2] as keyof typeof people] ?? DEV_CUSTOMER
signInitData(who, shop.bot.token)
    .then((initData) => process.stdout.write(`${initData}\n`))
    .catch((error: unknown) => {
        console.error(error)
        process.exit(1)
    })

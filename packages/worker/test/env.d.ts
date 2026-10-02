import type { D1Migration } from "cloudflare:test"

declare global {
    namespace Cloudflare {
        interface Env {
            TEST_MIGRATIONS: D1Migration[]
            TOKEN_ENC_KEY: string
            PLATFORM_BOT_TOKEN: string
            PLATFORM_WEBHOOK_SECRET: string
            PLATFORM_ADMIN_IDS: string
            COURIER_BOT_TOKEN: string
            COURIER_WEBHOOK_SECRET: string
        }
    }
}

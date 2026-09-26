import path from "node:path"

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

export default defineConfig(async () => {
    const migrations = await readD1Migrations(path.join(__dirname, "migrations"))

    return {
        plugins: [
            cloudflareTest({
                wrangler: { configPath: "./wrangler.jsonc" },
                miniflare: {
                    bindings: {
                        TEST_MIGRATIONS: migrations,
                        // Test-only secrets. Production values are set with `wrangler secret put`.
                        // secret-scan: fake (a known test key, never used outside tests)
                        TOKEN_ENC_KEY: "a2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2s=", // secret-scan: fake
                        PLATFORM_BOT_TOKEN: "100000:platform-bot-token-for-tests-only-xxxxx",
                        PLATFORM_WEBHOOK_SECRET: "platform-webhook-secret",
                        PLATFORM_ADMIN_IDS: "9999",
                        APP_ORIGIN: "https://lls-app.pages.dev",
                    },
                },
            }),
        ],
        test: {
            setupFiles: ["./test/setup.ts"],
            // workerd supports istanbul coverage only (not v8).
            coverage: {
                provider: "istanbul" as const,
                include: ["src/**"],
                thresholds: {
                    "src/routes/**": { lines: 70, functions: 70, statements: 70 },
                },
            },
        },
    }
})

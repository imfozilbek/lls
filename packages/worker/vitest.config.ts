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
                    // Tests sign up and search many times as the same user; the limit itself is
                    // checked in rate-limit.test.ts with its own tight limiter.
                    ratelimits: {
                        SEARCH_LIMITER: {
                            namespace_id: "1001",
                            simple: { limit: 1000, period: 60 },
                        },
                        SIGNUP_LIMITER: {
                            namespace_id: "1002",
                            simple: { limit: 1000, period: 60 },
                        },
                        TEST_TIGHT_LIMITER: {
                            namespace_id: "9001",
                            simple: { limit: 2, period: 60 },
                        },
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

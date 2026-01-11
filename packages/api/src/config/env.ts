import { z } from "zod"

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(4001),
    HOST: z.string().default("0.0.0.0"),
    MONGODB_URI: z.string().default("mongodb://localhost:27017/lls"),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(): Env {
    const result = envSchema.safeParse(process.env)

    if (!result.success) {
        console.error("Invalid environment variables:")
        console.error(result.error.format())
        process.exit(1)
    }

    return result.data
}

export const env = loadEnv()

import { z } from "zod"

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(4001),
    HOST: z.string().default("0.0.0.0"),
    MONGODB_URI: z.string().default("mongodb://localhost:27017/lls"),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
})

export interface AppConfig {
    nodeEnv: "development" | "production" | "test"
    port: number
    host: string
    mongoUri: string
    redisUrl: string
    telegramBotToken: string
    logLevel: "debug" | "info" | "warn" | "error"
}

let cachedConfig: AppConfig | null = null

export function configuration(): AppConfig {
    if (cachedConfig) {
        return cachedConfig
    }

    const result = envSchema.safeParse(process.env)

    if (!result.success) {
        console.error("Invalid environment variables:")
        console.error(result.error.format())
        process.exit(1)
    }

    cachedConfig = {
        nodeEnv: result.data.NODE_ENV,
        port: result.data.PORT,
        host: result.data.HOST,
        mongoUri: result.data.MONGODB_URI,
        redisUrl: result.data.REDIS_URL,
        telegramBotToken: result.data.TELEGRAM_BOT_TOKEN,
        logLevel: result.data.LOG_LEVEL,
    }

    return cachedConfig
}

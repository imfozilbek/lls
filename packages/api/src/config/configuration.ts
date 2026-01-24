import { z } from "zod"

import { logger } from "../common/logger.js"

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(4001),
    HOST: z.string().default("0.0.0.0"),
    MONGODB_URI: z.string().default("mongodb://localhost:27017/lls"),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:5174"),
    RATE_LIMIT_TTL: z.coerce.number().default(60000),
    RATE_LIMIT_MAX: z.coerce.number().default(100),
})

export interface AppConfig {
    nodeEnv: "development" | "production" | "test"
    port: number
    host: string
    mongoUri: string
    redisUrl: string
    telegramBotToken: string
    logLevel: "debug" | "info" | "warn" | "error"
    corsOrigins: string[]
    rateLimitTtl: number
    rateLimitMax: number
}

let cachedConfig: AppConfig | null = null

export function configuration(): AppConfig {
    if (cachedConfig) {
        return cachedConfig
    }

    const result = envSchema.safeParse(process.env)

    if (!result.success) {
        logger.error("Invalid environment variables:")
        logger.error(JSON.stringify(result.error.format(), null, 2))
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
        corsOrigins: result.data.CORS_ORIGINS.split(",").map((o) => o.trim()),
        rateLimitTtl: result.data.RATE_LIMIT_TTL,
        rateLimitMax: result.data.RATE_LIMIT_MAX,
    }

    return cachedConfig
}

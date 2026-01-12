import { configuration } from "../config/configuration.js"

type LogLevel = "debug" | "info" | "warn" | "error"

const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
}

function shouldLog(level: LogLevel): boolean {
    const config = configuration()
    return levels[level] >= levels[config.logLevel]
}

function formatMessage(level: LogLevel, message: unknown): string {
    const timestamp = new Date().toISOString()
    const msg = message instanceof Error ? message.stack ?? message.message : String(message)
    return `[${timestamp}] ${level.toUpperCase()}: ${msg}`
}

export const logger = {
    debug(message: unknown): void {
        if (shouldLog("debug")) {
            process.stdout.write(formatMessage("debug", message) + "\n")
        }
    },

    info(message: unknown): void {
        if (shouldLog("info")) {
            process.stdout.write(formatMessage("info", message) + "\n")
        }
    },

    warn(message: unknown): void {
        if (shouldLog("warn")) {
            console.warn(formatMessage("warn", message))
        }
    },

    error(message: unknown): void {
        if (shouldLog("error")) {
            console.error(formatMessage("error", message))
        }
    },
}

export type Logger = typeof logger

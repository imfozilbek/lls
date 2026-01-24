import { env } from "./env.js"

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
    level: LogLevel
    message: string
    context?: string
    data?: unknown
    timestamp: string
}

class Logger {
    private context?: string

    constructor(context?: string) {
        this.context = context
    }

    private formatMessage(level: LogLevel, message: string, data?: unknown): LogEntry {
        return {
            level,
            message,
            context: this.context,
            data,
            timestamp: new Date().toISOString(),
        }
    }

    private shouldLog(level: LogLevel): boolean {
        // In production, only log warnings and errors
        if (env.isProd) {
            return level === "warn" || level === "error"
        }
        return true
    }

    private output(entry: LogEntry): void {
        if (!this.shouldLog(entry.level)) {
            return
        }

        const prefix = entry.context ? `[${entry.context}]` : ""
        const msg = `${prefix} ${entry.message}`

        switch (entry.level) {
            case "debug":
            case "info":
                // Use info for dev logging (allowed by eslint)
                // eslint-disable-next-line no-console
                console.info(msg, entry.data ?? "")
                break
            case "warn":
                // console.warn is allowed by eslint
                console.warn(msg, entry.data ?? "")
                break
            case "error":
                // console.error is allowed by eslint
                console.error(msg, entry.data ?? "")
                break
        }
    }

    debug(message: string, data?: unknown): void {
        this.output(this.formatMessage("debug", message, data))
    }

    info(message: string, data?: unknown): void {
        this.output(this.formatMessage("info", message, data))
    }

    warn(message: string, data?: unknown): void {
        this.output(this.formatMessage("warn", message, data))
    }

    error(message: string, data?: unknown): void {
        this.output(this.formatMessage("error", message, data))
    }

    child(context: string): Logger {
        return new Logger(this.context ? `${this.context}:${context}` : context)
    }
}

export const logger = new Logger()

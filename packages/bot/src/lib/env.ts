/**
 * Environment configuration with validation
 */

interface EnvConfig {
    apiUrl: string
    wsUrl: string
    mode: "development" | "production"
    isDev: boolean
    isProd: boolean
}

function getEnvVar(key: string, defaultValue: string): string {
    const value = import.meta.env[key] as string | undefined
    return value ?? defaultValue
}

function validateEnv(): EnvConfig {
    const apiUrl = getEnvVar("VITE_API_URL", "http://localhost:4001/api/v1")
    const wsUrl = getEnvVar("VITE_WS_URL", "http://localhost:4001")
    const mode = getEnvVar("VITE_MODE", "development") as "development" | "production"

    // Validate URLs
    if (!apiUrl.startsWith("http://") && !apiUrl.startsWith("https://")) {
        throw new Error(`Invalid VITE_API_URL: ${apiUrl}. Must start with http:// or https://`)
    }

    if (!wsUrl.startsWith("http://") && !wsUrl.startsWith("https://")) {
        throw new Error(`Invalid VITE_WS_URL: ${wsUrl}. Must start with http:// or https://`)
    }

    const isDev = mode === "development"
    const isProd = mode === "production"

    return {
        apiUrl,
        wsUrl,
        mode,
        isDev,
        isProd,
    }
}

export const env = validateEnv()

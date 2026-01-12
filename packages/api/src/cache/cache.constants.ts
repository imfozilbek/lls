export const REDIS_CLIENT = Symbol("REDIS_CLIENT")

export const CacheTTL = {
    SHORT: 60,          // 1 minute
    MEDIUM: 300,        // 5 minutes
    LONG: 3600,         // 1 hour
    DAY: 86400,         // 24 hours
} as const

export const CachePrefix = {
    BUSINESS: "lls:business",
    PRODUCT: "lls:product",
    CUSTOMER: "lls:customer",
    COURIER: "lls:courier",
    ORDER: "lls:order",
    SESSION: "lls:session",
} as const

export function buildCacheKey(prefix: string, id: string): string {
    return `${prefix}:${id}`
}

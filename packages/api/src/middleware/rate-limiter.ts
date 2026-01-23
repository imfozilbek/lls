import { Injectable } from "@nestjs/common"
import { ThrottlerGuard, ThrottlerException } from "@nestjs/throttler"

import type { ExecutionContext } from "@nestjs/common"
import type { FastifyRequest } from "fastify"

/**
 * Custom rate limiter guard that extracts client identifier from Fastify request
 */
@Injectable()
export class RateLimiterGuard extends ThrottlerGuard {
    protected async getTracker(req: FastifyRequest): Promise<string> {
        // Use X-Forwarded-For header if behind proxy, otherwise use IP
        const forwardedFor = req.headers["x-forwarded-for"]
        if (forwardedFor) {
            const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(",")[0]
            return ip?.trim() ?? "unknown"
        }
        return req.ip ?? "unknown"
    }

    protected async throwThrottlingException(
        _context: ExecutionContext,
        _throttlerLimitDetail: { limit: number; ttl: number; key: string; tracker: string },
    ): Promise<void> {
        throw new ThrottlerException("Too many requests. Please try again later.")
    }
}

/**
 * Rate limit configuration presets
 */
export const RATE_LIMIT_PRESETS = {
    // General API: 100 requests per minute
    general: {
        ttl: 60000,
        limit: 100,
    },
    // Auth endpoints: 10 requests per minute
    auth: {
        ttl: 60000,
        limit: 10,
    },
    // Order creation: 20 requests per minute
    orders: {
        ttl: 60000,
        limit: 20,
    },
    // Analytics: 30 requests per minute
    analytics: {
        ttl: 60000,
        limit: 30,
    },
} as const

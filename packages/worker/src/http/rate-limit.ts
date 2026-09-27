import { createMiddleware } from "hono/factory"

import { ApiError } from "./errors.js"

import type { AppEnv } from "../env.js"
import type { MiddlewareHandler } from "hono"

type Limiter = "SEARCH_LIMITER" | "SIGNUP_LIMITER"

/**
 * Per-user limit (Workers Rate Limiting binding). Keyed by the verified Telegram id, so one user
 * cannot burn the free D1 quota or flood the admins. Runs after `authenticate`.
 */
export function rateLimit(limiter: Limiter): MiddlewareHandler<AppEnv> {
    return createMiddleware<AppEnv>(async (c, next) => {
        const { success } = await c.env[limiter].limit({ key: String(c.get("auth").user.id) })
        if (!success) {
            throw new ApiError(429, "TOO_MANY_REQUESTS", "Too many requests, try again in a minute")
        }
        await next()
    })
}

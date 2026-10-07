import { createMiddleware } from "hono/factory"

import { ApiError } from "./errors.js"

import type { AppEnv } from "../env.js"
import type { Context, MiddlewareHandler } from "hono"

type Limiter = "SEARCH_LIMITER" | "SIGNUP_LIMITER" | "CLIENT_ERROR_LIMITER" | "BULK_LIMITER"

/** The verified Telegram id: for routes after `authenticate`. */
export const byUser = (c: Context<AppEnv>): string => String(c.get("auth").user.id)

/** The caller's address: for the few routes that come before any sign-in. */
export const byAddress = (c: Context<AppEnv>): string =>
    c.req.header("CF-Connecting-IP") ?? "unknown"

/**
 * Per-user (or per-address) limit (Workers Rate Limiting binding), so one caller cannot burn the
 * free D1 quota or flood the admins.
 */
export function rateLimit(
    limiter: Limiter,
    keyOf: (c: Context<AppEnv>) => string = byUser,
): MiddlewareHandler<AppEnv> {
    return createMiddleware<AppEnv>(async (c, next) => {
        const { success } = await c.env[limiter].limit({ key: keyOf(c) })
        if (!success) {
            throw new ApiError(429, "TOO_MANY_REQUESTS", "Too many requests, try again in a minute")
        }
        await next()
    })
}

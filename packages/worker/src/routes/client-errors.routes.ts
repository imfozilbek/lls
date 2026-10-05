import { safeCrashText } from "@zumda/core"
import { Hono } from "hono"

import { alertAdmins } from "../alerts.js"
import { ApiError } from "../http/errors.js"
import { byAddress, rateLimit } from "../http/rate-limit.js"
import { clientErrorBody } from "../http/schemas.js"

import type { AppEnv } from "../env.js"

/** A crash report is a few hundred bytes; anything bigger is not ours. */
const MAX_BODY_BYTES = 2048

/**
 * `POST /api/client-errors`: a Mini App crash, before any sign-in (it may happen before one).
 * The app sends it as text/plain, so the browser asks no CORS preflight: one Worker request per
 * crash. Only the safe facts are kept: the detail is cleaned again here, the client is not
 * trusted. One JSON line in the log and the admins' alert (once per 10 minutes).
 */
export const clientErrorRoutes = new Hono<AppEnv>().post(
    "/",
    rateLimit("CLIENT_ERROR_LIMITER", byAddress),
    async (c) => {
        if (Number(c.req.header("Content-Length") ?? 0) > MAX_BODY_BYTES) {
            throw new ApiError(413, "TOO_LARGE", "A crash report is small")
        }
        const text = await c.req.text()
        if (text.length > MAX_BODY_BYTES) {
            throw new ApiError(413, "TOO_LARGE", "A crash report is small")
        }
        let raw: unknown
        try {
            raw = JSON.parse(text)
        } catch {
            throw new ApiError(400, "VALIDATION_ERROR", "Not JSON")
        }
        const parsed = clientErrorBody.safeParse(raw)
        if (!parsed.success) {
            throw new ApiError(400, "VALIDATION_ERROR", "Not a crash report")
        }
        const facts = { ...parsed.data, detail: safeCrashText(parsed.data.detail) }
        console.warn(JSON.stringify({ event: "client_error", ...facts }))
        const where = `${facts.screen} ${facts.where}`.trim()
        c.executionCtx.waitUntil(
            alertAdmins(c.get("services"), "client_error", `${facts.name}: ${facts.detail}`, where),
        )
        return c.body(null, 204)
    },
)

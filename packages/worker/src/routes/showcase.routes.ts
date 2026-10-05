import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { ApiError } from "../http/errors.js"
import { rateLimit } from "../http/rate-limit.js"
import { onInvalid, showcaseQuery, slugParam } from "../http/schemas.js"

import type { AppEnv } from "../env.js"

/** The Zumda showcase: shops and one search across them, opened from the Zumda bot. */
export const showcaseRoutes = new Hono<AppEnv>()
    .use(async (c, next) => {
        if (c.get("auth").business) {
            throw new ApiError(400, "PLATFORM_ONLY", "Open this from the Zumda bot")
        }
        await next()
    })

    .get("/shops", async (c) => {
        const shops = await c.get("services").useCases.listShowcaseShops.execute()
        return c.json({ data: shops, meta: { page: 1, limit: shops.length, total: shops.length } })
    })

    /** A Zumda Shop QR of a shop that left the showcase: where its own bot is. */
    .get("/shops/:slug/bot", zValidator("param", slugParam, onInvalid), async (c) => {
        const { slug } = c.req.valid("param")
        return c.json(await c.get("services").useCases.shopBotOf.execute(slug))
    })

    .get(
        "/products",
        rateLimit("SEARCH_LIMITER"),
        zValidator("query", showcaseQuery, onInvalid),
        async (c) => {
            const { q, ...query } = c.req.valid("query")
            const page = await c
                .get("services")
                .useCases.searchShowcase.execute({ ...query, text: q })
            return c.json(page)
        },
    )

import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { ApiError } from "../http/errors.js"
import { onInvalid, showcaseQuery } from "../http/schemas.js"

import type { AppEnv } from "../env.js"

/** The LLS showcase: shops and one search across them, opened from the LLS bot. */
export const showcaseRoutes = new Hono<AppEnv>()
    .use(async (c, next) => {
        if (c.get("auth").business) {
            throw new ApiError(400, "PLATFORM_ONLY", "Open this from the LLS bot")
        }
        await next()
    })

    .get("/shops", async (c) => {
        const shops = await c.get("services").useCases.listShowcaseShops.execute()
        return c.json({ data: shops, meta: { page: 1, limit: shops.length, total: shops.length } })
    })

    .get("/products", zValidator("query", showcaseQuery, onInvalid), async (c) => {
        const { q, ...query } = c.req.valid("query")
        const page = await c.get("services").useCases.searchShowcase.execute({ ...query, text: q })
        return c.json(page)
    })

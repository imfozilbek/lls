import { Hono } from "hono"

import { IMAGE_KEY_PREFIX, IMMUTABLE_CACHE } from "../http/images.js"

import type { AppEnv } from "../env.js"

/** Public product photos and logos from R2, cached at the edge. Keys are random and immutable. */
export const imageRoutes = new Hono<AppEnv>().get("/*", async (c) => {
    const key = c.req.path.replace(/^\/img\//, "")
    if (!key.startsWith(IMAGE_KEY_PREFIX) || key.includes("..")) {
        return c.notFound()
    }

    const cache = caches.default
    const cached = await cache.match(c.req.raw)
    if (cached) {
        return cached
    }

    const object = await c.env.BUCKET.get(key)
    if (!object) {
        return c.notFound()
    }
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set("ETag", object.httpEtag)
    headers.set("Cache-Control", IMMUTABLE_CACHE)
    // Never let a browser guess another type (e.g. HTML) from the bytes.
    headers.set("X-Content-Type-Options", "nosniff")
    // Public photos: the app may draw the logo on a canvas (the QR poster) and export it.
    headers.set("Access-Control-Allow-Origin", "*")
    const response = new Response(object.body, { headers })
    c.executionCtx.waitUntil(cache.put(c.req.raw, response.clone()))
    return response
})

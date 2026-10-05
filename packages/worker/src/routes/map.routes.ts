import { Hono } from "hono"
import { cors } from "hono/cors"

import { IMMUTABLE_CACHE } from "../http/images.js"

import type { AppEnv, Bindings } from "../env.js"

/**
 * Zumda's own map of Uzbekistan, from R2 (`scripts/map-data.mjs` puts it there): the app never
 * talks to an outside map server.
 *
 *   GET /map/current.json             which map file is current (changes about once a month)
 *   GET /map/uzbekistan-*.pmtiles     the map, read by the app in byte ranges (HTTP 206)
 *   GET /map/fonts/:font/:range.pbf   label glyphs (an empty set for a range we do not keep)
 *   GET /map/sprites/:file            icons
 *
 * Public like product photos, but only our Mini App's addresses get CORS. Map files never change
 * under their name (a new map is a new file), so every range is cached at the edge for good.
 */
const PREFIX = "map"
const CURRENT_KEY = `${PREFIX}/current.json`
const MAP_FILE = /^uzbekistan-\d{8}\.pmtiles$/
/** The style names its fonts by slug (as kept in R2, read from map.zumda.shop); old styles by name. */
const FONT = /^(Noto Sans (Regular|Medium|Italic)|noto-sans-(regular|medium|italic))$/
const GLYPH_RANGE = /^(\d{1,5})-(\d{1,5})\.pbf$/
const SPRITE = /^light(@2x)?\.(json|png)$/
const RANGE = /^bytes=(\d+)-(\d*)$/
/** The app reads a few KB per tile and the directories in pieces; a bigger range is not ours. */
const MAX_RANGE_BYTES = 16 * 1024 * 1024
/** A new map shows up within this time. */
const CURRENT_CACHE = "public, max-age=300"
const TOTAL_HEADER = "X-Map-Size"

const PMTILES_TYPE = "application/vnd.pmtiles"
const PROTOBUF_TYPE = "application/x-protobuf"

interface ByteRange {
    offset: number
    length: number
}

function appOrigins(env: Bindings): string[] {
    return [env.APP_ORIGIN, env.BUSINESS_APP_ORIGIN, env.COURIER_APP_ORIGIN]
}

/** `bytes=a-b` only: one range, as the map reader asks. */
function parseRange(header: string | undefined): ByteRange | null {
    const match = RANGE.exec(header ?? "")
    if (!match) {
        return null
    }
    const start = Number(match[1])
    const end = match[2] === "" ? start + MAX_RANGE_BYTES - 1 : Number(match[2])
    if (end < start || end - start + 1 > MAX_RANGE_BYTES) {
        return null
    }
    return { offset: start, length: end - start + 1 }
}

function rangeResponse(
    body: BodyInit | null,
    range: ByteRange,
    total: number,
    etag: string,
): Response {
    const end = Math.min(range.offset + range.length, total) - 1
    return new Response(body, {
        status: 206,
        headers: {
            "Content-Type": PMTILES_TYPE,
            "Content-Range": `bytes ${range.offset}-${end}/${total}`,
            "Content-Length": String(end - range.offset + 1),
            "Cache-Control": IMMUTABLE_CACHE,
            ETag: etag,
            "Accept-Ranges": "bytes",
        },
    })
}

/** The edge copy of one range: a plain 200 (the cache keeps no 206), with the file's size. */
function cacheKey(url: string, range: ByteRange): Request {
    const key = new URL(url)
    key.search = `?r=${range.offset}-${range.offset + range.length - 1}`
    return new Request(key.toString())
}

async function servedObject(
    env: Bindings,
    key: string,
    type: string,
    cacheControl: string,
): Promise<Response | null> {
    const object = await env.BUCKET.get(key)
    if (!object) {
        return null
    }
    return new Response(object.body, {
        headers: {
            "Content-Type": type,
            "Cache-Control": cacheControl,
            ETag: object.httpEtag,
            "X-Content-Type-Options": "nosniff",
        },
    })
}

/** One range of the map file; R2 refuses a range that starts past the end. */
async function readRange(
    env: Bindings,
    key: string,
    range: ByteRange,
): Promise<R2ObjectBody | null | "past-end"> {
    try {
        return await env.BUCKET.get(key, { range })
    } catch {
        const head = await env.BUCKET.head(key)
        return head ? "past-end" : null
    }
}

export const mapRoutes = new Hono<AppEnv>()
    .use(
        "/*",
        cors({
            origin: (origin, c) => (appOrigins(c.env).includes(origin) ? origin : null),
            allowMethods: ["GET"],
            allowHeaders: ["Range"],
            exposeHeaders: ["Content-Range", "Content-Length", "ETag", "Accept-Ranges"],
            maxAge: 86_400,
        }),
    )
    .get("/current.json", async (c) => {
        const served = await servedObject(c.env, CURRENT_KEY, "application/json", CURRENT_CACHE)
        return served ?? c.json({ error: { code: "NO_MAP", message: "No map yet" } }, 404)
    })
    .get("/fonts/:font/:range", async (c) => {
        const font = c.req.param("font")
        const glyphs = GLYPH_RANGE.exec(c.req.param("range"))
        if (!FONT.test(font) || !glyphs) {
            return c.notFound()
        }
        // Stored without spaces: "Noto Sans Regular" is `noto-sans-regular` (scripts/map-data.mjs).
        const slug = font.toLowerCase().replaceAll(" ", "-")
        const key = `${PREFIX}/fonts/${slug}/${c.req.param("range")}`
        const served = await servedObject(c.env, key, PROTOBUF_TYPE, IMMUTABLE_CACHE)
        // A script we do not keep (e.g. Chinese in a far label): an empty glyph set, no error.
        return (
            served ??
            new Response(null, {
                headers: { "Content-Type": PROTOBUF_TYPE, "Cache-Control": IMMUTABLE_CACHE },
            })
        )
    })
    .get("/sprites/:file", async (c) => {
        const file = c.req.param("file")
        if (!SPRITE.test(file)) {
            return c.notFound()
        }
        const type = file.endsWith(".png") ? "image/png" : "application/json"
        const served = await servedObject(c.env, `${PREFIX}/sprites/${file}`, type, IMMUTABLE_CACHE)
        return served ?? c.notFound()
    })
    .get("/:file", async (c) => {
        const file = c.req.param("file")
        if (!MAP_FILE.test(file)) {
            return c.notFound()
        }
        const range = parseRange(c.req.header("Range"))
        if (!range) {
            return c.json(
                { error: { code: "RANGE_REQUIRED", message: "Read the map in byte ranges" } },
                416,
            )
        }
        const etag = `"${file}"`
        const key = cacheKey(c.req.url, range)
        const cached = await caches.default.match(key)
        if (cached) {
            const total = Number(cached.headers.get(TOTAL_HEADER))
            return rangeResponse(cached.body, range, total, etag)
        }

        const object = await readRange(c.env, `${PREFIX}/${file}`, range)
        if (object === "past-end") {
            return c.json(
                { error: { code: "RANGE_NOT_SATISFIABLE", message: "Past the end" } },
                416,
            )
        }
        if (!object) {
            return c.notFound()
        }
        const bytes = await new Response(object.body).arrayBuffer()
        const edgeCopy = new Response(bytes, {
            headers: { "Cache-Control": IMMUTABLE_CACHE, [TOTAL_HEADER]: String(object.size) },
        })
        c.executionCtx.waitUntil(caches.default.put(key, edgeCopy))
        return rangeResponse(bytes, range, object.size, etag)
    })

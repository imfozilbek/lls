import { exports } from "cloudflare:workers"
import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

const ORIGIN = "https://zumda-app.pages.dev"
const FILE = "uzbekistan-20261004.pmtiles"
const SIZE = 100_000

/** A fake map: byte i is i mod 251, so any range can be checked. */
function mapBytes(): Uint8Array {
    return Uint8Array.from({ length: SIZE }, (_, i) => i % 251)
}

function get(path: string, headers: Record<string, string> = {}): Promise<Response> {
    return exports.default.fetch(`http://worker/map${path}`, {
        headers: { Origin: ORIGIN, ...headers },
    })
}

describe("/map", () => {
    beforeEach(async () => {
        await env.BUCKET.delete("map/current.json")
    })

    it("says there is no map before the first upload", async () => {
        const response = await get("/current.json")
        expect(response.status).toBe(404)
        expect(await response.json()).toMatchObject({ error: { code: "NO_MAP" } })
    })

    it("gives the current map's name, briefly cached, to our app only", async () => {
        await env.BUCKET.put("map/current.json", JSON.stringify({ file: FILE, date: "20261004" }))
        const response = await get("/current.json")
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ file: FILE })
        expect(response.headers.get("Cache-Control")).toBe("public, max-age=300")
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN)

        const foreign = await get("/current.json", { Origin: "https://evil.example" })
        expect(foreign.headers.get("Access-Control-Allow-Origin")).toBeNull()
    })

    it("serves the map in byte ranges (206), the same bytes again from the edge copy", async () => {
        const bytes = mapBytes()
        await env.BUCKET.put(`map/${FILE}`, bytes)

        for (let round = 0; round < 2; round++) {
            const response = await get(`/${FILE}`, { Range: "bytes=1000-1099" })
            expect(response.status).toBe(206)
            expect(response.headers.get("Content-Range")).toBe(`bytes 1000-1099/${SIZE}`)
            expect(response.headers.get("ETag")).toBe(`"${FILE}"`)
            expect(response.headers.get("Cache-Control")).toContain("immutable")
            expect(response.headers.get("Access-Control-Expose-Headers")).toContain("Content-Range")
            expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes.slice(1000, 1100))
        }

        // The last bytes: the range is cut at the end of the file.
        const tail = await get(`/${FILE}`, { Range: `bytes=${SIZE - 10}-${SIZE + 50}` })
        expect(tail.status).toBe(206)
        expect(tail.headers.get("Content-Range")).toBe(`bytes ${SIZE - 10}-${SIZE - 1}/${SIZE}`)
        expect((await tail.arrayBuffer()).byteLength).toBe(10)
    })

    it("refuses the whole file, a range past the end and other names", async () => {
        await env.BUCKET.put(`map/${FILE}`, mapBytes())
        expect((await get(`/${FILE}`)).status).toBe(416)
        expect((await get(`/${FILE}`, { Range: "bytes=0-99999999" })).status).toBe(416)
        expect((await get(`/${FILE}`, { Range: `bytes=${SIZE + 5}-${SIZE + 9}` })).status).toBe(416)
        expect((await get("/uzbekistan-20200101.pmtiles", { Range: "bytes=0-9" })).status).toBe(404)
        expect((await get("/secret.json", { Range: "bytes=0-9" })).status).toBe(404)
    })

    it("answers the preflight of a range request", async () => {
        const response = await exports.default.fetch(`http://worker/map/${FILE}`, {
            method: "OPTIONS",
            headers: {
                Origin: ORIGIN,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "range",
            },
        })
        expect(response.status).toBe(204)
        expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Range")
    })

    it("serves glyphs and icons, an empty set for a script we do not keep", async () => {
        await env.BUCKET.put("map/fonts/Noto Sans Regular/0-255.pbf", new Uint8Array([1, 2, 3]))
        await env.BUCKET.put("map/sprites/light.json", "{}")

        const glyphs = await get("/fonts/Noto%20Sans%20Regular/0-255.pbf")
        expect(glyphs.status).toBe(200)
        expect(new Uint8Array(await glyphs.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))

        const missing = await get("/fonts/Noto%20Sans%20Regular/19968-20223.pbf")
        expect(missing.status).toBe(200)
        expect((await missing.arrayBuffer()).byteLength).toBe(0)

        expect((await get("/fonts/Comic%20Sans/0-255.pbf")).status).toBe(404)
        const sprite = await get("/sprites/light.json")
        expect(sprite.headers.get("Content-Type")).toBe("application/json")
        expect((await get("/sprites/dark.json")).status).toBe(404)
        expect((await get("/sprites/light@2x.png")).status).toBe(404)
    })
})

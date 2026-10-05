#!/usr/bin/env node
/**
 * Builds Zumda's own map of Uzbekistan and (with --upload) puts it into R2.
 *
 *   node scripts/map-data.mjs                 # build into map-build/
 *   node scripts/map-data.mjs --upload        # build, then upload to R2 `zumda-media` (map/)
 *   node scripts/map-data.mjs --bbox=68.74,40.46,68.82,40.52 --out=packages/e2e/stand/map
 *                                             # a small piece (the e2e stand's fixture)
 *
 * Where the map comes from:
 * - the whole world's OpenStreetMap build of Protomaps (`v4.pmtiles`) on the Source Cooperative
 *   mirror: build.protomaps.com cuts long downloads;
 * - `go-pmtiles` (protomaps, GitHub releases, pinned with checksums) cuts out only Uzbekistan and
 *   reads only that piece over the network (HTTP ranges), never the whole world;
 * - label fonts and icons from `protomaps/basemaps-assets` (a pinned commit).
 *
 * In R2 (bucket `zumda-media`):
 *   map/uzbekistan-YYYYMMDD.pmtiles     the map
 *   map/fonts/<font-slug>/<range>.pbf   label glyphs (noto-sans-regular: no spaces in R2 keys,
 *                                       wrangler would store them %20-encoded)
 *   map/sprites/light[@2x].{json,png}   icons
 *   map/current.json                    which map the app gets: written LAST, so the switch is
 *                                       atomic; the map before it stays, older ones are removed
 * R2 serves them itself at https://map.zumda.shop/map/... (the app in production, no Worker
 * request); the Worker serves the same keys under /map for the stand and local dev
 * (packages/worker/src/routes/map.routes.ts).
 *
 * Upload needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (wrangler reads them).
 */
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { arch, platform } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const WORKER_DIR = join(ROOT, "packages/worker")

const SOURCE = "https://data.source.coop/protomaps/openstreetmap/v4.pmtiles"
/** All of Uzbekistan with a margin: min lon, min lat, max lon, max lat. */
const UZBEKISTAN_BBOX = "55.9,37.1,73.2,45.6"
/**
 * z14 is about 260 MB for Uzbekistan, z15 about 530 MB. `wrangler r2 object put` takes at most
 * 300 MiB, and the app draws z15+ from z14 vector tiles (overzoom) with no visible loss.
 */
const DEFAULT_MAX_ZOOM = 14
const MAX_UPLOAD_BYTES = 300 * 1024 * 1024
const MIN_ZOOM_FLOOR = 12

const PMTILES_VERSION = "1.31.2"
const PMTILES_RELEASES = `https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}`
/** SHA-256 of each release archive: a swapped download never runs. */
const PMTILES_BUILDS = {
    "linux-x64": {
        file: `go-pmtiles_${PMTILES_VERSION}_Linux_x86_64.tar.gz`,
        sha256: "3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f",
    },
    "darwin-arm64": {
        file: `go-pmtiles-${PMTILES_VERSION}_Darwin_arm64.zip`,
        sha256: "40528f7f616fcbf91207cd48c8fc023d213f6d86c0cbf1f748732803d1880f3d",
    },
    "darwin-x64": {
        file: `go-pmtiles-${PMTILES_VERSION}_Darwin_x86_64.zip`,
        sha256: "1f0dc02eee6c58312dd6c509faee1b5c32f0596568af1bf51f1b034e7a88a65b",
    },
}

const ASSETS_COMMIT = "028c18f713baecad011301ff7a69acc39bcc2ae7"
const ASSETS = `https://raw.githubusercontent.com/protomaps/basemaps-assets/${ASSETS_COMMIT}`
/** The fonts of the Protomaps light style. */
const FONTS = ["Noto Sans Regular", "Noto Sans Medium", "Noto Sans Italic"]
/**
 * Glyph ranges up to U+20FF: Latin with its extensions (Uzbek oʻ, gʻ use U+02BB), Cyrillic
 * (Russian names in OSM), punctuation. The Worker answers other ranges with an empty set.
 */
const GLYPH_RANGES = Array.from({ length: 33 }, (_, i) => `${i * 256}-${i * 256 + 255}`)
const SPRITES = ["light.json", "light.png", "light@2x.json", "light@2x.png"]

const BUCKET = "zumda-media"
const PREFIX = "map"
const CURRENT = `${PREFIX}/current.json`

function option(name, fallback) {
    const flag = process.argv.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`))
    if (!flag) {
        return fallback
    }
    return flag.includes("=") ? flag.slice(flag.indexOf("=") + 1) : true
}

function log(message) {
    console.warn(`map: ${message}`)
}

function fail(message) {
    console.error(`map: ${message}`)
    process.exit(1)
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, { stdio: "inherit", ...options })
    if (result.status !== 0) {
        fail(`${command} ${args[0] ?? ""} failed (${result.status ?? result.signal})`)
    }
    return result
}

async function download(url) {
    for (let attempt = 1; ; attempt++) {
        try {
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }
            return Buffer.from(await response.arrayBuffer())
        } catch (error) {
            if (attempt >= 4) {
                fail(`cannot download ${url}: ${error.message}`)
            }
            await new Promise((done) => setTimeout(done, 2000 * 2 ** (attempt - 1)))
        }
    }
}

/** The pinned go-pmtiles for this machine, checked against its SHA-256. */
async function pmtilesBinary(binDir) {
    const build = PMTILES_BUILDS[`${platform()}-${arch()}`]
    if (!build) {
        fail(`no go-pmtiles build pinned for ${platform()}-${arch()}`)
    }
    const binary = join(binDir, "pmtiles")
    if (existsSync(binary)) {
        return binary
    }
    mkdirSync(binDir, { recursive: true })
    log(`downloading go-pmtiles ${PMTILES_VERSION}`)
    const archive = await download(`${PMTILES_RELEASES}/${build.file}`)
    const sha256 = createHash("sha256").update(archive).digest("hex")
    if (sha256 !== build.sha256) {
        fail(`go-pmtiles checksum mismatch: ${sha256}`)
    }
    const archivePath = join(binDir, build.file)
    writeFileSync(archivePath, archive)
    if (build.file.endsWith(".zip")) {
        run("unzip", ["-o", "-q", archivePath, "pmtiles", "-d", binDir])
    } else {
        run("tar", ["-xzf", archivePath, "-C", binDir, "pmtiles"])
    }
    chmodSync(binary, 0o755)
    return binary
}

/** Cuts the area out of the world build; a lower max zoom when the file is too big to upload. */
function extract(binary, { bbox, maxZoom, file }) {
    for (let zoom = maxZoom; zoom >= MIN_ZOOM_FLOOR; zoom--) {
        log(`extracting ${bbox} up to zoom ${zoom}`)
        run(binary, ["extract", SOURCE, file, `--bbox=${bbox}`, `--maxzoom=${zoom}`])
        const size = statSync(file).size
        log(`${file}: ${(size / 1024 / 1024).toFixed(1)} MB`)
        if (size <= MAX_UPLOAD_BYTES) {
            return zoom
        }
        log(`over ${MAX_UPLOAD_BYTES / 1024 / 1024} MB: trying zoom ${zoom - 1}`)
    }
    return fail("the map does not fit the upload limit even at the lowest zoom")
}

async function assets(outDir) {
    log(`downloading ${FONTS.length * GLYPH_RANGES.length} glyph files and the sprites`)
    for (const font of FONTS) {
        mkdirSync(join(outDir, "fonts", font), { recursive: true })
        for (const range of GLYPH_RANGES) {
            const url = `${ASSETS}/fonts/${encodeURIComponent(font)}/${range}.pbf`
            writeFileSync(join(outDir, "fonts", font, `${range}.pbf`), await download(url))
        }
    }
    mkdirSync(join(outDir, "sprites"), { recursive: true })
    for (const sprite of SPRITES) {
        writeFileSync(
            join(outDir, "sprites", sprite),
            await download(`${ASSETS}/sprites/v4/${sprite}`),
        )
    }
}

/** "Noto Sans Regular" → "noto-sans-regular": the Worker maps the style's font stack the same way. */
function fontSlug(font) {
    return font.toLowerCase().replaceAll(" ", "-")
}

function wrangler(args, options = {}) {
    return run("bunx", ["wrangler", "r2", "object", ...args, "--remote"], {
        cwd: WORKER_DIR,
        ...options,
    })
}

/**
 * How long a copy may be kept (R2 serves these headers on map.zumda.shop, and the Worker on the
 * stand): a dated map file never changes; fonts and icons keep their names across maps; the
 * pointer to the current map changes about once a month.
 */
const CACHE_MAP_FILE = "public, max-age=31536000, immutable"
const CACHE_ASSET = "public, max-age=86400"
const CACHE_CURRENT = "public, max-age=300"

/** Throws instead of exiting: an upload that fails half way cleans up after itself. */
function put(key, file, contentType, cacheControl) {
    const result = spawnSync(
        "bunx",
        [
            "wrangler",
            "r2",
            "object",
            "put",
            `${BUCKET}/${key}`,
            `--file=${file}`,
            `--content-type=${contentType}`,
            `--cache-control=${cacheControl}`,
            "--remote",
        ],
        { cwd: WORKER_DIR, stdio: ["ignore", "ignore", "inherit"] },
    )
    if (result.status !== 0) {
        throw new Error(`upload of ${key} failed (${result.status ?? result.signal})`)
    }
}

/** What R2 serves now, or null on the first run. Any other failure stops the run. */
function currentInR2() {
    const result = spawnSync(
        "bunx",
        ["wrangler", "r2", "object", "get", `${BUCKET}/${CURRENT}`, "--remote", "--pipe"],
        { cwd: WORKER_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    )
    if (result.status !== 0) {
        if (/does not exist|not found|NoSuchKey/i.test(result.stderr ?? "")) {
            return null
        }
        // Unknown is not "nothing": guessing would delete or overwrite the map people use.
        return fail(`cannot read ${CURRENT}: ${(result.stderr ?? "").trim().slice(0, 300)}`)
    }
    try {
        return JSON.parse(result.stdout)
    } catch {
        return fail(`${CURRENT} in R2 is not JSON`)
    }
}

/** The map files in R2 (`map/uzbekistan-*.pmtiles`), through the Cloudflare API. */
async function mapFilesInR2() {
    const base = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}`
    const files = []
    let cursor = ""
    do {
        const query = new URLSearchParams({ prefix: `${PREFIX}/uzbekistan-`, per_page: "100" })
        if (cursor) {
            query.set("cursor", cursor)
        }
        const response = await fetch(`${base}/r2/buckets/${BUCKET}/objects?${query}`, {
            headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
        })
        const body = await response.json()
        if (!response.ok || !body.success) {
            throw new Error(`cannot list the map files (HTTP ${response.status})`)
        }
        files.push(...body.result.map((object) => object.key.slice(PREFIX.length + 1)))
        cursor = body.result_info?.is_truncated ? body.result_info.cursor : ""
    } while (cursor)
    return files
}

function remove(file) {
    wrangler(["delete", `${BUCKET}/${PREFIX}/${file}`], { stdio: ["ignore", "ignore", "inherit"] })
    log(`removed ${file}`)
}

function putAll(outDir, current) {
    put(
        `${PREFIX}/${current.file}`,
        join(outDir, current.file),
        "application/vnd.pmtiles",
        CACHE_MAP_FILE,
    )
    for (const font of FONTS) {
        for (const range of GLYPH_RANGES) {
            const key = `${PREFIX}/fonts/${fontSlug(font)}/${range}.pbf`
            const file = join(outDir, "fonts", font, `${range}.pbf`)
            put(key, file, "application/x-protobuf", CACHE_ASSET)
        }
    }
    for (const sprite of SPRITES) {
        const type = sprite.endsWith(".png") ? "image/png" : "application/json"
        put(`${PREFIX}/sprites/${sprite}`, join(outDir, "sprites", sprite), type, CACHE_ASSET)
    }
}

async function upload(outDir, current) {
    if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
        fail("upload needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID")
    }
    const before = currentInR2()
    log(`uploading ${current.file} (now in R2: ${before?.file ?? "nothing"})`)
    const next = {
        ...current,
        previous: before?.file !== current.file ? before?.file : before?.previous,
    }
    try {
        putAll(outDir, current)
        writeFileSync(join(outDir, "current.json"), `${JSON.stringify(next, null, 4)}\n`)
        // Last: until now the app keeps getting the map before.
        put(CURRENT, join(outDir, "current.json"), "application/json", CACHE_CURRENT)
    } catch (error) {
        // current.json still points to the old map: the new file is only taking room.
        if (current.file !== before?.file && current.file !== before?.previous) {
            remove(current.file)
        }
        fail(error instanceof Error ? error.message : String(error))
    }
    log(`switched to ${current.file}`)
    // Only the map and the one before it (a session that opened it keeps reading it) stay: a
    // file left by any earlier failed or older run goes too, so R2 never grows month by month.
    const keep = new Set([next.file, next.previous])
    for (const file of await mapFilesInR2()) {
        if (!keep.has(file)) {
            remove(file)
        }
    }
}

/** Builds the map, its fonts and icons into outDir; returns what current.json says. */
async function build(outDir) {
    const bbox = option("bbox", UZBEKISTAN_BBOX)
    const maxZoom = Number(option("maxzoom", DEFAULT_MAX_ZOOM))
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "")
    const file = `uzbekistan-${date}.pmtiles`
    mkdirSync(outDir, { recursive: true })

    const binary = await pmtilesBinary(join(ROOT, "map-build", ".bin"))
    const zoom = extract(binary, { bbox, maxZoom, file: join(outDir, file) })
    const current = { file, date, bbox, maxzoom: zoom, source: SOURCE }
    writeFileSync(join(outDir, "current.json"), `${JSON.stringify(current, null, 4)}\n`)
    if (option("no-assets", false) !== true) {
        await assets(outDir)
    }
    return current
}

async function main() {
    const outDir = resolve(ROOT, option("out", "map-build"))
    // --reuse: upload what an earlier run built (CI builds without secrets, then uploads).
    const built = join(outDir, "current.json")
    const current =
        option("reuse", false) === true && existsSync(built)
            ? JSON.parse(readFileSync(built, "utf8"))
            : await build(outDir)
    if (option("upload", false) === true) {
        await upload(outDir, current)
    }
    log(`done: ${outDir}`)
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))

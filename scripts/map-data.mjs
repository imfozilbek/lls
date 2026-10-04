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
 *   map/fonts/<font>/<range>.pbf        label glyphs
 *   map/sprites/light[@2x].{json,png}   icons
 *   map/current.json                    which map the app gets: written LAST, so the switch is
 *                                       atomic; the map before it stays, older ones are removed
 * The Worker serves them under /map (packages/worker/src/routes/map.routes.ts).
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

function wrangler(args, options = {}) {
    return run("bunx", ["wrangler", "r2", "object", ...args, "--remote"], {
        cwd: WORKER_DIR,
        ...options,
    })
}

function put(key, file, contentType) {
    wrangler(["put", `${BUCKET}/${key}`, `--file=${file}`, `--content-type=${contentType}`], {
        stdio: ["ignore", "ignore", "inherit"],
    })
}

/** What R2 serves now, or null on the first run. */
function currentInR2() {
    const result = spawnSync(
        "bunx",
        ["wrangler", "r2", "object", "get", `${BUCKET}/${CURRENT}`, "--remote", "--pipe"],
        { cwd: WORKER_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    )
    try {
        return result.status === 0 ? JSON.parse(result.stdout) : null
    } catch {
        return null
    }
}

function upload(outDir, current) {
    if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
        fail("upload needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID")
    }
    const before = currentInR2()
    log(`uploading ${current.file} (now in R2: ${before?.file ?? "nothing"})`)
    put(`${PREFIX}/${current.file}`, join(outDir, current.file), "application/vnd.pmtiles")
    for (const font of FONTS) {
        for (const range of GLYPH_RANGES) {
            const key = `${PREFIX}/fonts/${font}/${range}.pbf`
            put(key, join(outDir, "fonts", font, `${range}.pbf`), "application/x-protobuf")
        }
    }
    for (const sprite of SPRITES) {
        const type = sprite.endsWith(".png") ? "image/png" : "application/json"
        put(`${PREFIX}/sprites/${sprite}`, join(outDir, "sprites", sprite), type)
    }
    const next = {
        ...current,
        previous: before?.file !== current.file ? before?.file : before?.previous,
    }
    writeFileSync(join(outDir, "current.json"), `${JSON.stringify(next, null, 4)}\n`)
    // Last: until now the app keeps getting the map before.
    put(CURRENT, join(outDir, "current.json"), "application/json")
    log(`switched to ${current.file}`)
    // Keep the map before (a session that opened it keeps reading it); remove the older one.
    const stale = before?.previous
    if (stale && stale !== next.file && stale !== next.previous) {
        wrangler(["delete", `${BUCKET}/${PREFIX}/${stale}`])
        log(`removed ${stale}`)
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
        upload(outDir, current)
    }
    log(`done: ${outDir}`)
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))

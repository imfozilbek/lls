// Plays stage.html frame by frame: `preview t1 t2 ...` saves stills, `video out.mp4` encodes.
// Env: STAGE_URL (the served stage, `?role=` picks one role), REEL_DIR (work dir), FFMPEG.
import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { writeFileSync } from "node:fs"

// Playwright of the e2e package: no download, the browser the stand already uses.
const require = createRequire(new URL("../../../packages/e2e/package.json", import.meta.url))
const { chromium } = require("@playwright/test")

const [mode, ...rest] = process.argv.slice(2)
const STAGE = process.env.STAGE_URL ?? "http://127.0.0.1:8899/stage.html"
const DIR = process.env.REEL_DIR
const FPS = 30
const FFMPEG = process.env.FFMPEG

const browser = await chromium.launch()
const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
})
page.on("console", (m) => {
    if (m.type() === "error") console.error("page:", m.text())
})
page.on("pageerror", (e) => console.error("pageerror:", e.message))
await page.goto(STAGE)
await page.waitForFunction(
    () => window.READY === true || document.title.startsWith("ERROR"),
    null,
    { timeout: 60000 },
)
const title = await page.title()
if (title.startsWith("ERROR")) {
    console.error(title)
    process.exit(1)
}
const timeline = await page.evaluate(() => window.TIMELINE)
writeFileSync(
    `${DIR}/${process.env.TIMELINE ?? "timeline.json"}`,
    JSON.stringify(timeline, null, 2),
)
console.log("duration", timeline.duration.toFixed(2))

if (mode === "preview") {
    for (const t of rest.map(Number)) {
        await page.evaluate((x) => window.render(x), t)
        await page.screenshot({
            path: `${DIR}/preview/${process.env.PREFIX ?? "p"}-${t.toFixed(2)}.png`,
        })
    }
} else if (mode === "video") {
    const out = rest[0]
    const total = Math.ceil(timeline.duration * FPS)
    const ff = spawn(
        FFMPEG,
        [
            "-y",
            "-loglevel",
            "error",
            "-f",
            "image2pipe",
            "-framerate",
            String(FPS),
            "-c:v",
            "mjpeg",
            "-i",
            "-",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            out,
        ],
        { stdio: ["pipe", "inherit", "inherit"] },
    )
    const started = Date.now()
    for (let i = 0; i < total; i++) {
        await page.evaluate((x) => window.render(x), i / FPS)
        const jpg = await page.screenshot({ type: "jpeg", quality: 94 })
        if (!ff.stdin.write(jpg)) {
            await new Promise((r) => ff.stdin.once("drain", r))
        }
        if (i % 300 === 0)
            console.log(`frame ${i}/${total} ${((Date.now() - started) / 1000).toFixed(0)}s`)
    }
    ff.stdin.end()
    await new Promise((r) => ff.on("close", r))
    console.log("done", out)
}
await browser.close()

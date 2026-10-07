#!/usr/bin/env node
// The Mini App's first JS must stay small on slow regional mobile internet (CLAUDE.md:
// "Mini App initial JS <= 100 KB gzip"). Run after `vite build`: sums the gzip size of the entry
// script in dist/index.html and every chunk it imports statically, and fails above the budget.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { gzipSync } from "node:zlib"

const BUDGET_KB = 100
const KB = 1000
const dist = process.argv[2] ?? "dist"

const html = readFileSync(join(dist, "index.html"), "utf8")
const entries = [...html.matchAll(/<script type="module"[^>]*src="\/([^"]+)"/g)].map((m) => m[1])
const preloads = [...html.matchAll(/<link rel="modulepreload"[^>]*href="\/([^"]+)"/g)].map(
    (m) => m[1],
)

const seen = new Set()
const queue = [...entries, ...preloads]
let total = 0
while (queue.length > 0) {
    const file = queue.shift()
    if (seen.has(file)) {
        continue
    }
    seen.add(file)
    const code = readFileSync(join(dist, file))
    total += gzipSync(code, { level: 9 }).length
    // Static imports only: `import ... from "./x.js"` and `import "./x.js"`, never `import(...)`.
    const text = code.toString("utf8")
    for (const m of text.matchAll(/(?:^|[;}\s])import\s*(?:[\w${},*\s]+from\s*)?["'](\.\/[^"']+\.js)["']/g)) {
        queue.push(join("assets", m[1].slice(2)))
    }
}

const kb = (total / KB).toFixed(2)
if (total > BUDGET_KB * KB) {
    console.error(`✗ initial JS ${kb} KB gzip > ${BUDGET_KB} KB (${[...seen].join(", ")})`)
    process.exit(1)
}
console.warn(`✓ initial JS ${kb} KB gzip of ${BUDGET_KB} KB`)

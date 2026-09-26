import { Hono } from "hono"

import type { AppEnv } from "./env.js"

const app = new Hono<AppEnv>()

app.get("/health", (c) => c.json({ status: "ok" }))

export default app

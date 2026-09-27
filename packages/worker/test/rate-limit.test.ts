import { env } from "cloudflare:workers"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { toErrorResponse } from "../src/http/errors.js"
import { rateLimit } from "../src/http/rate-limit.js"

import type { AppEnv } from "../src/env.js"

describe("rateLimit", () => {
    it("lets a user through up to the limit, then answers 429 per user", async () => {
        const app = new Hono<AppEnv>()
            .use(async (c, next) => {
                const id = Number(c.req.query("user"))
                c.set("auth", { user: { id, firstName: "T" } } as AppEnv["Variables"]["auth"])
                await next()
            })
            // TEST_TIGHT_LIMITER exists only in tests: 2 requests a minute.
            .get("/", rateLimit("TEST_TIGHT_LIMITER" as Parameters<typeof rateLimit>[0]), (c) =>
                c.text("ok"),
            )
            .onError((error, c) => {
                const { status, body } = toErrorResponse(error)
                return c.json(body, status)
            })

        const call = (user: number): Promise<Response> =>
            Promise.resolve(app.request(`/?user=${user}`, {}, env))
        expect((await call(1)).status).toBe(200)
        expect((await call(1)).status).toBe(200)
        const blocked = await call(1)
        expect(blocked.status).toBe(429)
        expect(await blocked.json()).toMatchObject({ error: { code: "TOO_MANY_REQUESTS" } })
        // Another user is not affected.
        expect((await call(2)).status).toBe(200)
    })
})

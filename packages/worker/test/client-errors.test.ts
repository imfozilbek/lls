import { env } from "cloudflare:workers"
import { Hono } from "hono"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ALERT_QUIET_MS } from "../src/alerts.js"
import { toErrorResponse } from "../src/http/errors.js"
import { byAddress, rateLimit } from "../src/http/rate-limit.js"
import { ADMIN, testClient } from "./helpers.js"

import type { AppEnv } from "../src/env.js"
import type { TestClient } from "./helpers.js"
import type { Clock } from "@zumda/core"

const CRASH = {
    kind: "error",
    name: "TypeError",
    detail: "Cannot read properties of undefined (reading 'total')",
    where: "index-BzyS0hWw.js:12:3456",
    screen: "shop:checkout",
}

describe("Mini App crashes: POST /api/client-errors", () => {
    let client: TestClient
    let now: number
    let logged: string[]
    const clock: Clock = { now: () => new Date(now) }

    const report = (body: unknown, headers: Record<string, string> = {}): Promise<Response> =>
        client.request("/api/client-errors", {
            method: "POST",
            // What the app sends: no initData, no identity, text/plain (no CORS preflight).
            headers: { "Content-Type": "text/plain", ...headers },
            body: typeof body === "string" ? body : JSON.stringify(body),
        })
    const alerts = (): { html: string; token: string }[] =>
        client.telegram.sent.filter((m) => m.chatId === ADMIN.id && m.html.includes("🚨"))

    beforeEach(() => {
        now = Date.UTC(2026, 9, 5, 9, 0)
        client = testClient({ clock })
        logged = []
        vi.spyOn(console, "warn").mockImplementation((line: unknown) => {
            logged.push(String(line))
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("logs one JSON line and alerts the admins once per 10 minutes", async () => {
        const first = await report(CRASH)
        expect(first.status).toBe(204)
        expect(logged.map((line) => JSON.parse(line) as unknown)).toEqual([
            { event: "client_error", ...CRASH },
        ])
        expect(alerts()).toHaveLength(1)
        expect(alerts()[0]?.token).toBe(env.BUSINESS_BOT_TOKEN)
        expect(alerts()[0]?.html).toContain("ilovasida xato")
        expect(alerts()[0]?.html).toContain("shop:checkout index-BzyS0hWw.js:12:3456")
        expect(alerts()[0]?.html).toContain("TypeError: Cannot read properties")

        expect((await report(CRASH)).status).toBe(204)
        expect(logged).toHaveLength(2)
        expect(alerts()).toHaveLength(1)
        now += ALERT_QUIET_MS
        await report(CRASH)
        expect(alerts()).toHaveLength(2)
    })

    it("never keeps a phone, a name or a token, even when the client sends one", async () => {
        // secret-scan: fake (a made-up token shape)
        const leaky =
            "Fail for Азиз Каримов +998901234567 id 8421 token 123456:AAHfakeTokenForTests"
        expect((await report({ ...CRASH, detail: leaky })).status).toBe(204)
        const line = logged[0] ?? ""
        for (const secret of ["Азиз", "Каримов", "998", "8421", "AAHfakeTokenForTests"]) {
            expect(line).not.toContain(secret)
            expect(alerts()[0]?.html).not.toContain(secret)
        }
        expect(JSON.parse(line)).toMatchObject({ detail: "Fail for id token" })
    })

    it("takes only the crash's own short fields", async () => {
        const refused = [
            { ...CRASH, phone: "+998901234567" },
            { ...CRASH, kind: "warning" },
            { ...CRASH, name: "Type Error 1" },
            { ...CRASH, where: "https://evil.example/x.js:1:1" },
            { ...CRASH, screen: "Shop Checkout" },
            { ...CRASH, detail: "x".repeat(161) },
            "not json",
        ]
        for (const body of refused) {
            expect((await report(body)).status).toBe(400)
        }
        expect((await report({ ...CRASH, detail: "x".repeat(3000) })).status).toBe(413)
        expect(logged).toEqual([])
        expect(alerts()).toEqual([])
    })

    it("a crash with no place in our bundle still counts", async () => {
        expect((await report({ ...CRASH, where: "" })).status).toBe(204)
        expect(alerts()[0]?.html).toContain("shop:checkout\n")
    })
})

describe("rateLimit by address", () => {
    it("counts per caller's address, before any sign-in", async () => {
        const app = new Hono<AppEnv>()
            // TEST_TIGHT_LIMITER exists only in tests: 2 requests a minute.
            .post(
                "/",
                rateLimit("TEST_TIGHT_LIMITER" as Parameters<typeof rateLimit>[0], byAddress),
                (c) => c.body(null, 204),
            )
            .onError((error, c) => {
                const { status, body } = toErrorResponse(error)
                return c.json(body, status)
            })
        const call = (ip: string): Promise<Response> =>
            Promise.resolve(
                app.request("/", { method: "POST", headers: { "CF-Connecting-IP": ip } }, env),
            )
        expect((await call("10.0.0.1")).status).toBe(204)
        expect((await call("10.0.0.1")).status).toBe(204)
        expect((await call("10.0.0.1")).status).toBe(429)
        expect((await call("10.0.0.2")).status).toBe(204)
    })
})

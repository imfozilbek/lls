import { exports } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

describe("GET /health", () => {
    it("returns ok", async () => {
        const response = await exports.default.fetch("http://worker/health")

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ status: "ok" })
    })
})

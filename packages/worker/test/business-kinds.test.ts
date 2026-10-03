import { env } from "cloudflare:workers"
import { BusinessType, Language } from "@zumda/core"
import { describe, expect, it } from "vitest"

import { textsFor } from "../src/telegram/texts.js"

import { SHOP_BOT, SHOP_BOT_TOKEN, createActiveShop, testClient } from "./helpers.js"

describe("kinds of business: grocery store, restaurant, service", () => {
    it("a water shop becomes a grocery store and keeps its bottles", async () => {
        const client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        const { id } = await createActiveShop(client)
        await env.DB.prepare(
            `UPDATE businesses SET type = 'water', features = '["reorder","bottleDeposit"]',
                bottle_deposit = 30000 WHERE id = ?`,
        )
            .bind(id)
            .run()
        const kinds = env.TEST_MIGRATIONS.filter((m) => m.name.startsWith("0007"))
        expect(kinds).toHaveLength(1)
        // Applied again on purpose: the update must be safe to run on any database.
        await env.DB.batch(kinds[0]?.queries.map((sql) => env.DB.prepare(sql)) ?? [])
        const row = await env.DB.prepare(
            "SELECT type, features, bottle_deposit FROM businesses WHERE id = ?",
        )
            .bind(id)
            .first<{ type: string; features: string; bottle_deposit: number }>()
        expect(row).toEqual({
            type: "grocery",
            features: '["reorder","bottleDeposit"]',
            bottle_deposit: 30000,
        })
    })

    it("each kind speaks its own words", () => {
        const grocery = textsFor(Language.UZ, BusinessType.GROCERY)
        const food = textsFor(Language.UZ, BusinessType.FOOD)
        const service = textsFor(Language.UZ, BusinessType.SERVICE)
        expect(grocery.openMenu).toBe("🛒 Katalogni ochish")
        expect(food.openMenu).toBe("🍽 Menyuni ochish")
        expect(service.openMenu).toBe("🧰 Xizmatlarni ochish")
        expect(service.customerStatus.delivered).toContain("bajarildi")
        expect(service.shopTypes[BusinessType.SERVICE]).toBe("xizmat ko'rsatish")
        expect(grocery.shopTypes[BusinessType.GROCERY]).toBe("oziq-ovqat do'koni")
    })
})

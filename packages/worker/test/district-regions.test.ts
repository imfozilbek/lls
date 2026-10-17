import { env } from "cloudflare:workers"
import { Location, Region, districtOf } from "@zumda/core"
import { beforeEach, describe, expect, it } from "vitest"

import { D1DistrictRepository } from "../src/repositories/district.repository.js"

import { ADMIN, SHOP_BOT, SHOP_BOT_TOKEN, createActiveShop, testClient } from "./helpers.js"

import type { TestClient } from "./helpers.js"

const STANSIYA = "district-yakkabog-stansiyasi"
const POSYOLKA = "district-yakkabog-posyolkasi"
/** The town around the station and Eski Yakkabog': the two centers, about 14.5 km apart. */
const TOWN = { latitude: 38.9785, longitude: 66.6831 }
const SETTLEMENT = { latitude: 38.93139, longitude: 66.83889 }
/** A third of the way from the settlement to the town: nearer the settlement. */
const NEAR_SETTLEMENT = { latitude: 38.947, longitude: 66.787 }
/** About 25 km north of the town: outside both circles. */
const FAR_NORTH = { latitude: 39.203, longitude: 66.6831 }

/** Migration 0024 without its `ALTER TABLE` (applied once already): safe to run again. */
async function seedDistricts(): Promise<void> {
    const migration = env.TEST_MIGRATIONS.filter((m) => m.name.startsWith("0024"))
    expect(migration).toHaveLength(1)
    const statements = (migration[0]?.queries ?? []).filter((sql) => !sql.includes("ALTER TABLE"))
    expect(statements).toHaveLength(2)
    await env.DB.batch(statements.map((sql) => env.DB.prepare(sql)))
}

describe("viloyats and the two districts of Yakkabog'", () => {
    let client: TestClient
    let shopId: string

    async function placeShop(at: { latitude: number; longitude: number }): Promise<void> {
        await env.DB.prepare(
            "UPDATE businesses SET latitude = ?, longitude = ?, district_id = NULL WHERE id = ?",
        )
            .bind(at.latitude, at.longitude, shopId)
            .run()
    }

    async function districtOfShop(): Promise<string | null> {
        const row = await env.DB.prepare("SELECT district_id FROM businesses WHERE id = ?")
            .bind(shopId)
            .first<{ district_id: string | null }>()
        return row?.district_id ?? null
    }

    beforeEach(async () => {
        client = testClient({ bots: { [SHOP_BOT_TOKEN]: SHOP_BOT } })
        shopId = (await createActiveShop(client)).id
    })

    it("the migration makes both in Qashqadaryo, 20 km each, and puts each shop in the nearest", async () => {
        await seedDistricts()
        const districts = await new D1DistrictRepository(env.DB).list()
        expect(
            districts.map((d) => [d.id, d.name, d.region, d.radiusMeters, d.waitMinutes]),
        ).toEqual([
            [POSYOLKA, "Yakkabog' posyolkasi", Region.QASHQADARYO, 20_000, 10],
            [STANSIYA, "Yakkabog' stansiyasi", Region.QASHQADARYO, 20_000, 10],
        ])
        const places: [{ latitude: number; longitude: number }, string | null][] = [
            [TOWN, STANSIYA],
            [SETTLEMENT, POSYOLKA],
            [NEAR_SETTLEMENT, POSYOLKA],
            [FAR_NORTH, null],
        ]
        for (const [at, expected] of places) {
            await placeShop(at)
            await seedDistricts()
            expect(await districtOfShop()).toBe(expected)
            // The same district the app picks when an admin saves one in «Tumanlar».
            const core = districtOf(districts, Location.create(at.latitude, at.longitude))
            expect(core?.id ?? null).toBe(expected)
        }
    })

    it("a demo stays out; a district an admin made under the name is kept", async () => {
        await env.DB.prepare(
            `INSERT INTO districts (id, name, name_key, latitude, longitude, radius_m,
                created_at, updated_at) VALUES ('admin-made', 'Yakkabog'' stansiyasi',
                'yakkabog'' stansiyasi', 38.9785, 66.6831, 5000, 1, 1)`,
        ).run()
        await placeShop(TOWN)
        await env.DB.prepare("UPDATE businesses SET demo_at = 1 WHERE id = ?").bind(shopId).run()
        await seedDistricts()
        expect(await districtOfShop()).toBeNull()
        const ids = (await new D1DistrictRepository(env.DB).list()).map((d) => d.id)
        expect(ids).toEqual([POSYOLKA, "admin-made"])
        // A district made before the viloyat was asked reads with none.
        expect((await new D1DistrictRepository(env.DB).findById("admin-made"))?.region).toBe(
            undefined,
        )
    })

    it("«Tumanlar» needs the viloyat of a new district and shows it", async () => {
        const platform = client.as(ADMIN, { adminBot: true })
        const body = { name: "Qarshi", center: { latitude: 38.86, longitude: 65.79 }, radiusKm: 20 }
        const missing = await platform("/api/admin/districts", { method: "PUT", json: body })
        expect(missing.status).toBe(400)
        const wrong = await platform("/api/admin/districts", {
            method: "PUT",
            json: { ...body, region: "mars" },
        })
        expect(wrong.status).toBe(400)
        const made = await platform("/api/admin/districts", {
            method: "PUT",
            json: { ...body, region: "qashqadaryo", isNew: true },
        })
        expect(made.status).toBe(200)
        expect(await made.json()).toMatchObject({ name: "Qarshi", region: "qashqadaryo" })
        const moved = await platform("/api/admin/districts", {
            method: "PUT",
            json: { name: "Qarshi", region: "surxondaryo" },
        })
        expect(await moved.json()).toMatchObject({ region: "surxondaryo" })
        const list = await platform("/api/admin/districts")
        const { data } = (await list.json()) as { data: { name: string; region?: string }[] }
        expect(data).toEqual([expect.objectContaining({ name: "Qarshi", region: "surxondaryo" })])
    })
})

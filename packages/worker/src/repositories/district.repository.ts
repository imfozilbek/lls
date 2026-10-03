import { District, Location } from "@zumda/core"

import type { DistrictRepository } from "@zumda/core"

interface DistrictRow {
    id: string
    name: string
    latitude: number
    longitude: number
    radius_m: number
    wait_minutes: number
    created_at: number
    updated_at: number
}

const COLUMNS = "id, name, latitude, longitude, radius_m, wait_minutes, created_at, updated_at"

/** The admin types the name: «Guliston» and «guliston» are the same district. */
function nameKey(name: string): string {
    return name.trim().toLowerCase()
}

function toDistrict(row: DistrictRow): District {
    return District.reconstitute({
        id: row.id,
        name: row.name,
        center: Location.create(row.latitude, row.longitude),
        radiusMeters: row.radius_m,
        waitMinutes: row.wait_minutes,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    })
}

export class D1DistrictRepository implements DistrictRepository {
    constructor(private readonly db: D1Database) {}

    async findById(id: string): Promise<District | null> {
        const row = await this.db
            .prepare(`SELECT ${COLUMNS} FROM districts WHERE id = ?`)
            .bind(id)
            .first<DistrictRow>()
        return row ? toDistrict(row) : null
    }

    async findByName(name: string): Promise<District | null> {
        const row = await this.db
            .prepare(`SELECT ${COLUMNS} FROM districts WHERE name_key = ?`)
            .bind(nameKey(name))
            .first<DistrictRow>()
        return row ? toDistrict(row) : null
    }

    /** A handful of districts per region: no paging needed. */
    async list(): Promise<District[]> {
        const { results } = await this.db
            .prepare(`SELECT ${COLUMNS} FROM districts ORDER BY name_key`)
            .all<DistrictRow>()
        return results.map(toDistrict)
    }

    async save(district: District): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO districts (id, name, name_key, latitude, longitude, radius_m,
                    wait_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (id) DO UPDATE SET latitude = excluded.latitude,
                    longitude = excluded.longitude, radius_m = excluded.radius_m,
                    wait_minutes = excluded.wait_minutes, updated_at = excluded.updated_at`,
            )
            .bind(
                district.id,
                district.name,
                nameKey(district.name),
                district.center.latitude,
                district.center.longitude,
                district.radiusMeters,
                district.waitMinutes,
                district.createdAt.getTime(),
                district.updatedAt.getTime(),
            )
            .run()
    }
}

import type { District } from "../../domain/entities/district.js"

export interface DistrictRepository {
    findById(id: string): Promise<District | null>
    /** Names are unique, case-insensitive: the admin types them in the LLS bot. */
    findByName(name: string): Promise<District | null>
    list(): Promise<District[]>
    save(district: District): Promise<void>
}

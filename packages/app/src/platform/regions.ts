import { REGIONS } from "@zumda/core"

import type { DistrictStats, Region } from "@zumda/core"

/** The districts of one viloyat; `region` null holds those made before it was asked. */
export interface RegionGroup {
    region: Region | null
    districts: DistrictStats[]
}

/**
 * «Tumanlar» by viloyat: the 14 in their official order, only those with a district, then the
 * districts without one. Inside a group the server's order (by name) stays.
 */
export function byRegion(districts: readonly DistrictStats[]): RegionGroup[] {
    const groups: RegionGroup[] = REGIONS.map((region) => ({
        region,
        districts: districts.filter((district) => district.region === region),
    }))
    const known = new Set<string>(REGIONS)
    groups.push({
        region: null,
        districts: districts.filter(
            (district) => district.region === undefined || !known.has(district.region),
        ),
    })
    return groups.filter((group) => group.districts.length > 0)
}

/** A viloyat's name from one of the dictionary's two lists (full or short). */
export function regionName(names: Record<string, string>, region: Region): string {
    return names[region] ?? region
}

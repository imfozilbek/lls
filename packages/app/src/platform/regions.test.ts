import { REGIONS, Region } from "@zumda/core"
import { describe, expect, it } from "vitest"

import { staffUz } from "../i18n/staff.js"

import { byRegion, regionName } from "./regions.js"

import type { DistrictStats } from "@zumda/core"

function district(name: string, region?: Region | string): DistrictStats {
    return { id: name, name, region } as DistrictStats
}

describe("«Tumanlar» by viloyat", () => {
    it("the viloyats in their order, only those with a district, the rest last", () => {
        const groups = byRegion([
            district("Guliston", Region.SIRDARYO),
            district("Eski", undefined),
            district("Yakkabog' posyolkasi", Region.QASHQADARYO),
            district("Yakkabog' stansiyasi", Region.QASHQADARYO),
            district("Tomorrow", "mars"),
        ])
        expect(groups.map((g) => [g.region, g.districts.map((d) => d.name)])).toEqual([
            [Region.QASHQADARYO, ["Yakkabog' posyolkasi", "Yakkabog' stansiyasi"]],
            [Region.SIRDARYO, ["Guliston"]],
            [null, ["Eski", "Tomorrow"]],
        ])
        expect(byRegion([])).toEqual([])
    })

    it("every viloyat has its full and short name", () => {
        const { regions, regionsShort } = staffUz.platform
        expect(REGIONS).toHaveLength(14)
        for (const region of REGIONS) {
            expect(regionName(regions, region)).not.toBe(region)
            expect(regionName(regionsShort, region)).not.toBe(region)
        }
        expect(Object.keys(regions)).toEqual([...REGIONS])
        expect(regionName(regions, Region.QASHQADARYO)).toBe("Qashqadaryo viloyati")
        expect(regionName(regionsShort, Region.TOSHKENT_SHAHRI)).toBe("Toshkent shahri")
    })
})

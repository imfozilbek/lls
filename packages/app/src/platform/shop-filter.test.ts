import { describe, expect, it } from "vitest"

import { inShopFilter, lacksPhone, shopFilterCounts, shownShopFilters } from "./shop-filter.js"

import type { PlatformShopDTO } from "@zumda/core"

function shop(fields: Record<string, unknown>): PlatformShopDTO {
    return {
        demo: false,
        ownerChat: "open",
        owner: { phone: "+998901234567" },
        ...fields,
    } as unknown as PlatformShopDTO
}

describe("«Bizneslar» chips", () => {
    it("a shop lacks a phone only without its own and the owner's; a demo never does", () => {
        expect(lacksPhone(shop({ owner: {} }))).toBe(true)
        expect(lacksPhone(shop({ owner: {}, contactPhone: "+998901112233" }))).toBe(false)
        expect(lacksPhone(shop({ owner: {}, demo: true }))).toBe(false)
    })

    it("counts each chip and shows only the chips with shops", () => {
        const all = [
            shop({ marketplace: { commissionBps: 500, joinedAt: "2026-11-01" } }),
            shop({ demo: true }),
            shop({ owner: {}, ownerChat: "closed" }),
        ]
        expect(shopFilterCounts(all)).toEqual({
            all: 3,
            showcase: 1,
            demo: 1,
            noPhone: 1,
            chatClosed: 1,
        })
        expect(inShopFilter(all[2] as PlatformShopDTO, "chatClosed")).toBe(true)
        expect(shownShopFilters(shopFilterCounts([shop({})]))).toEqual([])
    })
})

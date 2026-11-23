import { describe, expect, it } from "vitest"

import {
    CollageLayout,
    MAX_POST_PHOTOS,
    cellsOf,
    collageSize,
    coverCrop,
    layoutOr,
    layoutsFor,
} from "./post-collage.js"

describe("a post's collage", () => {
    it("offers the layouts that fit the photos, the usual one first", () => {
        expect(layoutsFor(0)).toEqual([])
        expect(layoutsFor(1)).toEqual([CollageLayout.SINGLE])
        expect(layoutsFor(2)).toEqual([CollageLayout.SIDE, CollageLayout.STACK])
        expect(layoutsFor(3)).toEqual([CollageLayout.BIG_TWO])
        expect(layoutsFor(MAX_POST_PHOTOS)).toEqual([CollageLayout.GRID])
        expect(layoutsFor(5)).toEqual([])
    })

    it("keeps the owner's pick while it fits, else the usual one", () => {
        expect(layoutOr(CollageLayout.STACK, 2)).toBe(CollageLayout.STACK)
        // A third photo added: «Ustma-ust» no longer fits.
        expect(layoutOr(CollageLayout.STACK, 3)).toBe(CollageLayout.BIG_TWO)
        expect(layoutOr(null, 0)).toBeNull()
    })

    it("has a cell for each photo, together covering the whole picture once", () => {
        for (const count of [1, 2, 3, MAX_POST_PHOTOS]) {
            for (const layout of layoutsFor(count)) {
                const cells = cellsOf(layout)
                expect(cells).toHaveLength(count)
                const area = cells.reduce((sum, cell) => sum + cell.w * cell.h, 0)
                expect(area).toBeCloseTo(1)
            }
        }
    })

    it("one photo keeps its sides; a collage has its own", () => {
        const tall = { width: 3000, height: 4000 }
        expect(collageSize(CollageLayout.SINGLE, tall)).toEqual({ width: 960, height: 1280 })
        expect(collageSize(CollageLayout.SINGLE, { width: 600, height: 400 })).toEqual({
            width: 600,
            height: 400,
        })
        expect(collageSize(CollageLayout.GRID, tall)).toEqual({ width: 1280, height: 1280 })
        expect(collageSize(CollageLayout.STACK, tall)).toEqual({ width: 800, height: 1280 })
    })

    it("fills a cell with the photo's middle, never stretched", () => {
        // A wide photo in a square cell: its middle square.
        expect(coverCrop({ width: 400, height: 200 }, { width: 100, height: 100 })).toEqual({
            sx: 100,
            sy: 0,
            sw: 200,
            sh: 200,
        })
        // A tall photo in a wide cell: a band from its middle.
        const crop = coverCrop({ width: 300, height: 900 }, { width: 600, height: 300 })
        expect(crop).toEqual({ sx: 0, sy: 375, sw: 300, sh: 150 })
    })
})

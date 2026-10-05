import { describe, expect, it } from "vitest"

import { MAP_URL } from "../../lib/api.js"

import { mapStyle } from "./style.js"

describe("mapStyle", () => {
    const style = mapStyle("uzbekistan-20261004.pmtiles")

    it("names every font by its R2 slug, also inside expressions", () => {
        const fonts = JSON.stringify(
            style.layers.map((layer) =>
                layer.type === "symbol" ? layer.layout?.["text-font"] : null,
            ),
        )
        expect(fonts).toContain("noto-sans-regular")
        expect(fonts).toContain("noto-sans-medium")
        expect(fonts).not.toMatch(/Noto Sans/)
    })

    it("reads the map, glyphs and icons from one map address", () => {
        expect(style.glyphs).toBe(`${MAP_URL}/fonts/{fontstack}/{range}.pbf`)
        expect(style.sprite).toBe(`${MAP_URL}/sprites/light`)
        expect(JSON.stringify(style.sources)).toContain(
            `pmtiles://${MAP_URL}/uzbekistan-20261004.pmtiles`,
        )
    })
})

import { layers, namedFlavor } from "@protomaps/basemaps"

import { MAP_URL } from "../../lib/api.js"

import type { LayerSpecification, StyleSpecification } from "maplibre-gl"

/** The source name inside the style; layers refer to it. */
const SOURCE = "protomaps"

const FONT_NAME = /^Noto Sans (Regular|Medium|Italic)$/

/**
 * "Noto Sans Regular" → "noto-sans-regular", also inside expressions: the glyphs lie in R2 under
 * these names (no spaces in R2 keys), read straight from map.zumda.shop.
 */
function slugFonts(value: unknown): unknown {
    if (typeof value === "string") {
        return FONT_NAME.test(value) ? value.toLowerCase().replace(/ /g, "-") : value
    }
    return Array.isArray(value) ? value.map(slugFonts) : value
}

function withSlugFonts(layer: LayerSpecification): LayerSpecification {
    if (!("layout" in layer) || !layer.layout || !("text-font" in layer.layout)) {
        return layer
    }
    return {
        ...layer,
        layout: { ...layer.layout, "text-font": slugFonts(layer.layout["text-font"]) },
    } as LayerSpecification
}

/**
 * Protomaps' light map, all of it ours: the map file (pmtiles over HTTP ranges), label glyphs and
 * icons. Labels in Uzbek where OSM has them, else the local name (mostly Uzbek Latin).
 */
export function mapStyle(file: string): StyleSpecification {
    return {
        version: 8,
        glyphs: `${MAP_URL}/fonts/{fontstack}/{range}.pbf`,
        sprite: `${MAP_URL}/sprites/light`,
        sources: {
            [SOURCE]: {
                type: "vector",
                url: `pmtiles://${MAP_URL}/${file}`,
                attribution: "© OpenStreetMap",
            },
        },
        layers: layers(SOURCE, namedFlavor("light"), { lang: "uz" }).map(withSlugFonts),
    }
}

/** Road layers, for the street name under the pin. */
export function roadLayerIds(style: StyleSpecification): string[] {
    return style.layers
        .filter((layer) => "source-layer" in layer && layer["source-layer"] === "roads")
        .map((layer) => layer.id)
}

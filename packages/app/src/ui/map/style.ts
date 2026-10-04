import { layers, namedFlavor } from "@protomaps/basemaps"

import { API_URL } from "../../lib/api.js"

import type { StyleSpecification } from "maplibre-gl"

/** The source name inside the style; layers refer to it. */
const SOURCE = "protomaps"

/**
 * Protomaps' light map, all of it from our API: the map file (pmtiles over HTTP ranges), label
 * glyphs and icons. Labels in Uzbek where OSM has them, else the local name (mostly Uzbek Latin).
 */
export function mapStyle(file: string): StyleSpecification {
    return {
        version: 8,
        glyphs: `${API_URL}/map/fonts/{fontstack}/{range}.pbf`,
        sprite: `${API_URL}/map/sprites/light`,
        sources: {
            [SOURCE]: {
                type: "vector",
                url: `pmtiles://${API_URL}/map/${file}`,
                attribution: "© OpenStreetMap",
            },
        },
        layers: layers(SOURCE, namedFlavor("light"), { lang: "uz" }),
    }
}

/** Road layers, for the street name under the pin. */
export function roadLayerIds(style: StyleSpecification): string[] {
    return style.layers
        .filter((layer) => "source-layer" in layer && layer["source-layer"] === "roads")
        .map((layer) => layer.id)
}

import { BusinessType } from "@zumda/core"
import { describe, expect, it } from "vitest"

import raw from "../../public/catalog/v1.json?raw"

import { fold, indexCatalog, searchCatalog } from "./catalog.js"

const file = JSON.parse(raw) as { items: Parameters<typeof indexCatalog>[0] }
const catalog = indexCatalog(file.items)

describe("the Zumda catalog", () => {
    it("every template is a known category and unit", () => {
        expect(catalog.length).toBe(file.items.length)
        expect(catalog.length).toBeGreaterThan(2500)
    })

    it("finds osh, pepper, carpet washing and cement, each with what the owner needs", () => {
        const osh = searchCatalog(catalog, "osh", BusinessType.FOOD)
        expect(osh[0]?.category).toBe("osh")
        expect(osh.find((t) => t.name === "To'y oshi")).toMatchObject({
            unit: "portion",
            group: "Porsiya",
        })
        const pepper = searchCatalog(catalog, "murch", BusinessType.GROCERY)
        expect(pepper.find((t) => t.name === "Qora murch")).toMatchObject({
            unit: "g100",
            step: 100,
            category: "spices",
        })
        const carpet = searchCatalog(catalog, "gilam", BusinessType.SERVICE)
        expect(carpet[0]).toMatchObject({ name: "Gilam yuvish", unit: "m2", category: "carpet" })
        const cement = searchCatalog(catalog, "sement", BusinessType.STORE)
        expect(cement[0]?.category).toBe("building")
    })

    it("reads people's spellings: no apostrophe, Cyrillic, x for h, an alias", () => {
        expect(searchCatalog(catalog, "toy oshi", BusinessType.FOOD)[0]?.name).toBe("To'y oshi")
        expect(searchCatalog(catalog, "плов", BusinessType.FOOD).length).toBeGreaterThan(0)
        expect(fold("Choyhona")).toBe(fold("Choyxona"))
        expect(searchCatalog(catalog, "plov", BusinessType.FOOD)[0]?.category).toBe("osh")
    })

    it("an empty query finds nothing; licensed services are not in it", () => {
        expect(searchCatalog(catalog, "  ", BusinessType.FOOD)).toEqual([])
        expect(searchCatalog(catalog, "kapelnitsa", BusinessType.SERVICE)).toEqual([])
        expect(searchCatalog(catalog, "hijoma", BusinessType.SERVICE)).toEqual([])
    })
})

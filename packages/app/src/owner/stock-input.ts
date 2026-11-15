/** Grams in a kilogram: a kg product's stock is typed in kg and kept in grams. */
const GRAMS_PER_KG = 1000
/** Sold by the 100 g or the gram: the stock is typed in grams. */
const BY_GRAM = new Set(["g100", "g"])

/** The count as the owner types it: «12», or «12,5» kg for a product sold by the kilogram. */
export function stockText(stock: number | undefined, unit: string): string {
    if (stock === undefined) {
        return ""
    }
    return unit === "kg" ? String(stock / GRAMS_PER_KG).replace(".", ",") : String(stock)
}

/**
 * What the owner typed, in the order's base units (pieces, or grams), or null when it is not a
 * count: empty, negative, or a fraction of a piece.
 */
export function parseStock(text: string, unit: string): number | null {
    const clean = text.trim().replace(/\s/g, "").replace(",", ".")
    if (!/^\d+(\.\d+)?$/.test(clean)) {
        return null
    }
    const value = Number(clean)
    if (unit === "kg") {
        return Math.round(value * GRAMS_PER_KG)
    }
    return Number.isInteger(value) ? value : null
}

/** The word after the field: «kg» for kilograms, «g» for grams, the unit's own word otherwise. */
export function stockUnit(unit: string, units: Record<string, string>): string {
    if (BY_GRAM.has(unit)) {
        return units["g"] ?? "g"
    }
    return units[unit] ?? unit
}

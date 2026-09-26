export enum Unit {
    PIECE = "pcs",
    PORTION = "portion",
    KG = "kg",
    LITER = "l",
    BOTTLE_19L = "bottle_19l",
}

export const UNITS: readonly Unit[] = Object.values(Unit)

/** Quantities are integers in base units: grams for `kg`, pieces for everything else. */
export function unitScale(unit: Unit): number {
    return unit === Unit.KG ? GRAMS_PER_KG : 1
}

export const GRAMS_PER_KG = 1000
/** Default step for weight items: half a kilogram. */
export const DEFAULT_KG_STEP = 500

/**
 * What a price is for. Stored in products and order lines: add new ones, never rename or remove
 * one. The Zumda catalog (goal 17, October 2026) brought grams, packs, measures and service time.
 */
export enum Unit {
    PIECE = "pcs",
    PORTION = "portion",
    /** Price per kilogram; sold in gram steps. */
    KG = "kg",
    /** Price per 100 g; sold in gram steps (spices, nuts, sweets, tea). */
    G100 = "g100",
    /** Price per gram; sold in gram steps (saffron). */
    GRAM = "g",
    LITER = "l",
    BOTTLE_19L = "bottle_19l",
    BOTTLE_20L = "bottle_20l",
    PACK = "pack",
    BOX = "box",
    BUNCH = "bunch",
    SET = "set",
    PAIR = "pair",
    /** A tray of 30 eggs. */
    TRAY = "tray",
    SACK = "sack",
    ROLL = "roll",
    SHEET = "sheet",
    METRE = "m",
    SQUARE_METRE = "m2",
    CUBIC_METRE = "m3",
    HOUR = "hour",
    DAY = "day",
    MONTH = "month",
    SESSION = "session",
    TRIP = "trip",
    /** A hundredth of a hectare (field work). */
    SOTIX = "sotix",
}

export const UNITS: readonly Unit[] = Object.values(Unit)

export const GRAMS_PER_KG = 1000
/** Default step for weight items: half a kilogram. */
export const DEFAULT_KG_STEP = 500
const GRAMS_PER_100G = 100

/** Sold by weight: quantities are grams, the step is a number of grams. */
export const WEIGHT_UNITS: readonly Unit[] = [Unit.KG, Unit.G100, Unit.GRAM]

export function isWeightUnit(unit: Unit): boolean {
    return WEIGHT_UNITS.includes(unit)
}

/**
 * Quantities are integers in base units: grams for weight, pieces (or metres, hours...) for the
 * rest. A line costs `price × quantity / unitScale`.
 */
export function unitScale(unit: Unit): number {
    if (unit === Unit.KG) {
        return GRAMS_PER_KG
    }
    return unit === Unit.G100 ? GRAMS_PER_100G : 1
}

/** The step a new product of this unit starts with: 500 g, 100 g, 1 g, or one piece. */
export function defaultStep(unit: Unit): number {
    if (unit === Unit.KG) {
        return DEFAULT_KG_STEP
    }
    return unit === Unit.G100 ? GRAMS_PER_100G : 1
}

/** A returnable bottle unit: a new product of it starts with the deposit on. */
export function isBottleUnit(unit: Unit): boolean {
    return unit === Unit.BOTTLE_19L || unit === Unit.BOTTLE_20L
}

/** Measured, not counted: a carpet of 12 m² or 3 hours of work is one thing to carry or do. */
const MEASURE_UNITS: readonly Unit[] = [
    ...WEIGHT_UNITS,
    Unit.METRE,
    Unit.SQUARE_METRE,
    Unit.CUBIC_METRE,
    Unit.HOUR,
    Unit.DAY,
    Unit.MONTH,
    Unit.SESSION,
    Unit.TRIP,
    Unit.SOTIX,
]

/** How many packages a line makes for a courier: pieces as they are, a measured line as one. */
export function packagesOf(unit: Unit, quantity: number): number {
    return MEASURE_UNITS.includes(unit) ? 1 : quantity
}

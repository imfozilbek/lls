import { BusinessType } from "./business-type.js"
import { CategoryGroup } from "./category.js"
import { Feature } from "./feature.js"
import { Unit } from "./unit.js"

import type { Category } from "./category.js"

/** What each kind of shop gets switched on at registration. The owner can change it later. */
export const DEFAULT_FEATURES: Readonly<Record<BusinessType, readonly Feature[]>> = {
    [BusinessType.GROCERY]: [Feature.REORDER, Feature.WEIGHT_ITEMS, Feature.STOP_LIST],
    [BusinessType.FOOD]: [Feature.REORDER, Feature.STOP_LIST],
    [BusinessType.SERVICE]: [Feature.REORDER],
    [BusinessType.STORE]: [Feature.REORDER],
}

/** Categories shown first in the product editor. Every shop may still pick any category. */
export const SUGGESTED_CATEGORIES: Readonly<Record<BusinessType, readonly Category[]>> = {
    [BusinessType.FOOD]: [
        "meals",
        "osh",
        "soups",
        "dough",
        "grill",
        "lavash",
        "burgers",
        "pizza",
        "salads",
        "bakery",
        "desserts",
        "hot_drinks",
        "coffee",
        "drinks",
    ],
    [BusinessType.GROCERY]: [
        "groceries",
        "produce",
        "dairy",
        "meat",
        "bakery",
        "sweets",
        "spices",
        "drinks",
        "water",
        "household",
    ],
    [BusinessType.SERVICE]: [
        "cleaning",
        "carpet",
        "car_wash",
        "car_care",
        "repair",
        "beauty",
        "barber",
        "other",
    ],
    [BusinessType.STORE]: [
        "household",
        "chemicals",
        "hygiene",
        "kitchenware",
        "building",
        "electrical",
        "plumbing",
        "tools",
        "flowers",
        "other",
    ],
}

/** The shelf of the taxonomy a kind of shop sells from first. */
export const SHELF_OF: Readonly<Record<BusinessType, CategoryGroup>> = {
    [BusinessType.FOOD]: CategoryGroup.FOOD,
    [BusinessType.GROCERY]: CategoryGroup.GROCERY,
    [BusinessType.STORE]: CategoryGroup.GOODS,
    [BusinessType.SERVICE]: CategoryGroup.SERVICES,
}

/** Units that make sense for each kind of shop; the first one is the default for new products. */
export const SUGGESTED_UNITS: Readonly<Record<BusinessType, readonly Unit[]>> = {
    [BusinessType.FOOD]: [Unit.PORTION, Unit.PIECE, Unit.KG, Unit.LITER, Unit.SET],
    // A water shop picks «19 l» or «20 l» from here: water is a grocery store with the deposit.
    [BusinessType.GROCERY]: [
        Unit.PIECE,
        Unit.KG,
        Unit.G100,
        Unit.LITER,
        Unit.PACK,
        Unit.BUNCH,
        Unit.BOTTLE_19L,
        Unit.BOTTLE_20L,
    ],
    [BusinessType.SERVICE]: [Unit.PIECE, Unit.SQUARE_METRE, Unit.HOUR, Unit.SESSION, Unit.TRIP],
    [BusinessType.STORE]: [
        Unit.PIECE,
        Unit.PACK,
        Unit.METRE,
        Unit.SQUARE_METRE,
        Unit.SACK,
        Unit.KG,
    ],
}

import { BusinessType } from "./business-type.js"
import { Feature } from "./feature.js"
import { Unit } from "./unit.js"

import type { Category } from "./category.js"

/** What each kind of shop gets switched on at registration. The owner can change it later. */
export const DEFAULT_FEATURES: Readonly<Record<BusinessType, readonly Feature[]>> = {
    [BusinessType.FOOD]: [Feature.REORDER, Feature.STOP_LIST],
    [BusinessType.WATER]: [Feature.REORDER, Feature.BOTTLE_DEPOSIT],
    [BusinessType.GROCERY]: [Feature.REORDER, Feature.WEIGHT_ITEMS, Feature.STOP_LIST],
}

/** Categories shown first in the product editor. Every shop may still pick any category. */
export const SUGGESTED_CATEGORIES: Readonly<Record<BusinessType, readonly Category[]>> = {
    [BusinessType.FOOD]: [
        "meals",
        "soups",
        "salads",
        "grill",
        "pizza",
        "burgers",
        "bakery",
        "desserts",
        "drinks",
    ],
    [BusinessType.WATER]: ["water", "drinks", "other"],
    [BusinessType.GROCERY]: [
        "groceries",
        "produce",
        "dairy",
        "meat",
        "bakery",
        "drinks",
        "household",
    ],
}

/** Units that make sense for each kind of shop; the first one is the default for new products. */
export const SUGGESTED_UNITS: Readonly<Record<BusinessType, readonly Unit[]>> = {
    [BusinessType.FOOD]: [Unit.PORTION, Unit.PIECE, Unit.KG, Unit.LITER],
    [BusinessType.WATER]: [Unit.BOTTLE_19L, Unit.LITER, Unit.PIECE],
    [BusinessType.GROCERY]: [Unit.PIECE, Unit.KG, Unit.LITER],
}

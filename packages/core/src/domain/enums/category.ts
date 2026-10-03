/** Shared category taxonomy. Same ids in every shop so stage 2 can search across shops. */
export const CATEGORIES = [
    "meals",
    "soups",
    "salads",
    "grill",
    "pizza",
    "burgers",
    "bakery",
    "desserts",
    "drinks",
    "water",
    "dairy",
    "meat",
    "produce",
    "groceries",
    "household",
    "cleaning",
    "car_care",
    "repair",
    "beauty",
    "other",
] as const

export type Category = (typeof CATEGORIES)[number]

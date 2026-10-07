/**
 * Shared category taxonomy. Same ids in every shop so stage 2 can search across shops. Ids are
 * stored in products and order lines: add new ones, never rename or remove one (`oneOf` reads
 * refuse an unknown id). The list grew with the Zumda catalog (goal 17, October 2026).
 */
export const CATEGORIES = [
    // Cooked food («Ovqat»)
    "meals",
    "osh",
    "soups",
    "dough",
    "grill",
    "lavash",
    "burgers",
    "pizza",
    "chicken",
    "sushi",
    "asian",
    "european",
    "breakfast",
    "salads",
    "sides",
    "sauces",
    "bakery",
    "cakes",
    "desserts",
    "national_sweets",
    "ice_cream",
    "hot_drinks",
    "coffee",
    "drinks",
    "fresh",
    "milk_drinks",
    "combo",
    // Food to cook («Oziq-ovqat»)
    "produce",
    "greens",
    "dried_fruits",
    "nuts",
    "meat",
    "poultry",
    "fish",
    "deli",
    "dairy",
    "cheese",
    "eggs",
    "flour",
    "rice",
    "grains",
    "pasta",
    "oils",
    "sugar_salt",
    "spices",
    "canned",
    "pickles",
    "tea",
    "sweets",
    "cookies",
    "honey",
    "snacks",
    "water",
    "juices",
    "baby_food",
    "frozen",
    "ready_food",
    "groceries",
    // Goods («Mollar»)
    "household",
    "chemicals",
    "hygiene",
    "cosmetics",
    "baby_goods",
    "paper",
    "kitchenware",
    "textile",
    "clothes",
    "appliances",
    "stationery",
    "pets",
    "flowers",
    "building",
    "paint",
    "fasteners",
    "electrical",
    "plumbing",
    "tools",
    "garden",
    "auto_goods",
    "phone_goods",
    "gas",
    // Services («Xizmatlar»)
    "cleaning",
    "carpet",
    "car_wash",
    "car_care",
    "tyres",
    "repair",
    "gadgets",
    "electrician",
    "plumber",
    "welding",
    "construction",
    "climate",
    "windows",
    "furniture",
    "laundry",
    "tailoring",
    "workshop",
    "beauty",
    "barber",
    "massage",
    "events",
    "catering",
    "moving",
    "transport",
    "lessons",
    "farming",
    "wells",
    "yard",
    "printing",
    "rental",
    "documents",
    "nanny",
    "other",
] as const

export type Category = (typeof CATEGORIES)[number]

/** The four shelves of the taxonomy: what an owner picks from and what a kind of shop suggests. */
export enum CategoryGroup {
    FOOD = "food",
    GROCERY = "grocery",
    GOODS = "goods",
    SERVICES = "services",
}

export const CATEGORY_GROUPS: readonly CategoryGroup[] = Object.values(CategoryGroup)

const FIRST_OF: ReadonlyArray<[Category, CategoryGroup]> = [
    ["meals", CategoryGroup.FOOD],
    ["produce", CategoryGroup.GROCERY],
    ["household", CategoryGroup.GOODS],
    ["cleaning", CategoryGroup.SERVICES],
]

/** Which shelf a category stands on ("other" goes with the services, the last shelf). */
export function categoryGroup(category: Category): CategoryGroup {
    const at = CATEGORIES.indexOf(category)
    let group = CategoryGroup.FOOD
    for (const [first, shelf] of FIRST_OF) {
        if (at >= CATEGORIES.indexOf(first)) {
            group = shelf
        }
    }
    return group
}

/** The categories of one shelf, in the order of the list. */
export function categoriesOf(group: CategoryGroup): Category[] {
    return CATEGORIES.filter((category) => categoryGroup(category) === group)
}

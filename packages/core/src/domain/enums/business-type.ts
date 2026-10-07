/**
 * The kinds of business Zumda serves (owner's decision, October 2026). A water shop is a grocery
 * store with the bottle deposit switched on. The stored value of a restaurant stays `food`.
 */
export enum BusinessType {
    /** «Oziq-ovqat do'koni»: a grocery store (water included). */
    GROCERY = "grocery",
    /** «Restoran»: cooked food. */
    FOOD = "food",
    /** «Xizmat ko'rsatish»: services (cleaning, car care, repair...). */
    SERVICE = "service",
    /** «Do'kon»: goods that are not food (household, building, flowers...): goal 17. */
    STORE = "store",
}

export const BUSINESS_TYPES: readonly BusinessType[] = Object.values(BusinessType)

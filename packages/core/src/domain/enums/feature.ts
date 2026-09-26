/** Per-shop feature toggles. Add one only when a real client asks for it. */
export enum Feature {
    REORDER = "reorder",
    BOTTLE_DEPOSIT = "bottleDeposit",
    STOP_LIST = "stopList",
    WEIGHT_ITEMS = "weightItems",
}

export const FEATURES: readonly Feature[] = Object.values(Feature)

/**
 * The child's age a product is for, from this many years: «3+» (owner's decision, November
 * 2026). Stored as the number; only added to, never renamed.
 */
export const AGES = [0, 1, 3, 5, 7, 12] as const

export type Age = (typeof AGES)[number]

/** «3+», as the storefront and the form show it. */
export function ageLabel(age: Age): string {
    return `${age}+`
}

export function isAge(value: unknown): value is Age {
    return AGES.some((age) => age === value)
}

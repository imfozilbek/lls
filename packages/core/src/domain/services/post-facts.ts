import type { Product } from "../entities/product.js"
import type { Age } from "../enums/age.js"
import type { Unit } from "../enums/unit.js"

/**
 * What a channel post says about its product, kept true by Zumda: the name, the price («… so'm
 * dan» with variants) and the age. The owner's own words under the name stay as they wrote them;
 * the photo, the stock and whether it is on sale never change a post (owner's decision, November
 * 2026).
 */
export interface PostFacts {
    name: string
    /** Integer UZS per unit: the cheapest variant when there are variants. */
    price: number
    /** The price is the cheapest of the variants: «… so'm dan». */
    priceFrom: boolean
    unit: Unit
    ageFrom?: Age
}

export function postFactsOf(product: Product): PostFacts {
    return {
        name: product.name,
        price: product.price.amount,
        priceFrom: product.options?.hasVariants === true,
        unit: product.unit,
        ...(product.ageFrom === undefined ? {} : { ageFrom: product.ageFrom }),
    }
}

/** A short key of the facts: a post whose key differs from its product's is edited. */
export function postKeyOf(facts: PostFacts): string {
    return [facts.name, facts.price, facts.priceFrom ? 1 : 0, facts.unit, facts.ageFrom ?? ""].join(
        "|",
    )
}

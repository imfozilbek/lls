import { ValidationError } from "../errors/validation.error.js"
import { requireInteger, requireText } from "../shared/guards.js"

import { Money } from "./money.js"

/** One choice of a product with its own price: «0,4 l», «Katta», «Krossover». */
export interface ProductVariant {
    id: string
    name: string
    /** Integer UZS; replaces the product's price when chosen. */
    price: number
}

/** Something added on top: «Karamel sirop» +4 000, «Shakarsiz» for free. */
export interface ProductAddon {
    id: string
    name: string
    /** Integer UZS added to the price; 0 is «bepul». */
    price: number
}

export interface ProductOptionsProps {
    /** What the customer picks among the variants: «Hajmi», «O'lchami», «Mashina turi». */
    group?: string
    variants: ProductVariant[]
    addons: ProductAddon[]
}

/** The customer's pick: a variant (when the product has them) and any add-ons. */
export interface OptionChoice {
    variantId?: string
    addonIds?: readonly string[]
}

/** The pick as it is stored in an order line: ids for «Takrorlash», words for everyone else. */
export interface ChosenOptions {
    variantId?: string
    addonIds: string[]
    /** «0,4 l · Karamel sirop, Shakarsiz». */
    label: string
}

export const OPTION_LIMITS = {
    variants: 10,
    addons: 15,
    name: 40,
    group: 30,
} as const
const MAX_PRICE = 100_000_000
const ID = /^[a-z0-9]{1,12}$/

function checkId(field: string, id: string, seen: Set<string>): string {
    if (!ID.test(id) || seen.has(id)) {
        throw ValidationError.fromField(field, "Must be a unique id of 1-12 a-z0-9", id)
    }
    seen.add(id)
    return id
}

/**
 * Variants and add-ons of one product (goal 17). Prices are integer UZS; a variant's price
 * replaces the product's, add-ons are added on top. The order's price is always computed here, on
 * the server, from the ids the customer picked.
 */
export class ProductOptions {
    private constructor(private readonly props: ProductOptionsProps) {}

    static create(input: ProductOptionsProps): ProductOptions {
        const seen = new Set<string>()
        if (input.variants.length > OPTION_LIMITS.variants) {
            throw ValidationError.fromField(
                "variants",
                `At most ${OPTION_LIMITS.variants}`,
                input.variants.length,
            )
        }
        if (input.variants.length === 1) {
            throw ValidationError.fromField("variants", "A single variant is the product itself", 1)
        }
        if (input.addons.length > OPTION_LIMITS.addons) {
            throw ValidationError.fromField(
                "addons",
                `At most ${OPTION_LIMITS.addons}`,
                input.addons.length,
            )
        }
        const variants = input.variants.map((v) => ({
            id: checkId("variants.id", v.id, seen),
            name: requireText("variants.name", v.name, OPTION_LIMITS.name),
            price: requireInteger("variants.price", v.price, 1, MAX_PRICE),
        }))
        const addons = input.addons.map((a) => ({
            id: checkId("addons.id", a.id, seen),
            name: requireText("addons.name", a.name, OPTION_LIMITS.name),
            price: requireInteger("addons.price", a.price, 0, MAX_PRICE),
        }))
        const group = input.group?.trim()
        return new ProductOptions({
            group: group ? requireText("group", group, OPTION_LIMITS.group) : undefined,
            variants,
            addons,
        })
    }

    get group(): string | undefined {
        return this.props.group
    }
    get variants(): readonly ProductVariant[] {
        return this.props.variants
    }
    get addons(): readonly ProductAddon[] {
        return this.props.addons
    }
    get isEmpty(): boolean {
        return this.props.variants.length === 0 && this.props.addons.length === 0
    }
    get hasVariants(): boolean {
        return this.props.variants.length > 0
    }
    /** The cheapest variant: what «… so'm dan» shows and what the product's price becomes. */
    get lowestPrice(): number | undefined {
        return this.hasVariants ? Math.min(...this.props.variants.map((v) => v.price)) : undefined
    }

    /**
     * The price of one unit for this pick and the words for the order line. Returns null when the
     * pick does not fit: no variant where one is needed, or an id the product does not have.
     */
    price(base: Money, choice: OptionChoice): { unitPrice: Money; chosen?: ChosenOptions } | null {
        const variant = choice.variantId
            ? this.props.variants.find((v) => v.id === choice.variantId)
            : undefined
        if (this.hasVariants !== Boolean(variant) || (choice.variantId && !variant)) {
            return null
        }
        const ids = [...new Set(choice.addonIds ?? [])].sort()
        // In the owner's order, so «0,4 l · Karamel sirop, Shakarsiz» reads as the menu does.
        const picked = this.props.addons.filter((a) => ids.includes(a.id))
        if (picked.length !== ids.length) {
            return null
        }
        const unit = (variant?.price ?? base.amount) + picked.reduce((sum, a) => sum + a.price, 0)
        if (!variant && picked.length === 0) {
            return { unitPrice: base }
        }
        const words = [variant?.name, picked.map((a) => a.name).join(", ")].filter(Boolean)
        return {
            unitPrice: Money.of(unit),
            chosen: { variantId: variant?.id, addonIds: ids, label: words.join(" · ") },
        }
    }

    toJSON(): ProductOptionsProps {
        return {
            ...(this.props.group ? { group: this.props.group } : {}),
            variants: [...this.props.variants],
            addons: [...this.props.addons],
        }
    }
}

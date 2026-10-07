import { CATEGORIES } from "../enums/category.js"
import { UNITS, Unit, defaultStep, isWeightUnit } from "../enums/unit.js"
import { ValidationError } from "../errors/validation.error.js"
import { optionalText, requireInteger, requireOneOf, requireText } from "../shared/guards.js"
import { searchText } from "../shared/search-text.js"
import { addDays, startOfLocalDay } from "../shared/time.js"
import { Money } from "../value-objects/money.js"

import type { Category } from "../enums/category.js"

const NAME_MAX = 80
const DESCRIPTION_MAX = 500
const MAX_PRICE = 100_000_000
const MAX_POSITION = 100_000
/** A line holds at most 99 steps: 99 pieces, or 49.5 kg with a 500 g step. */
const MAX_STEPS_PER_LINE = 99
/** Weight steps: 10 g to 10 kg, or a single gram for goods priced per gram (saffron). */
const MIN_WEIGHT_STEP = 10
const MAX_WEIGHT_STEP = 10_000

export interface ProductProps {
    id: string
    businessId: string
    name: string
    description?: string
    price: Money
    unit: Unit
    /** Selling step in base units: grams for `kg`, always 1 for pieces. */
    step: number
    category: Category
    imageKey?: string
    isAvailable: boolean
    /** Stop-list: hidden until this moment (the next local midnight), then back on sale. */
    unavailableUntil?: Date
    /** A returnable container, e.g. a 19 l water bottle with a deposit. */
    returnable: boolean
    position: number
    createdAt: Date
    updatedAt: Date
}

export interface CreateProductProps {
    id: string
    businessId: string
    name: string
    description?: string
    price: number
    unit: string
    category: string
    step?: number
    returnable?: boolean
    position?: number
}

export interface ProductPatch {
    name?: string
    description?: string | null
    price?: number
    unit?: string
    category?: string
    step?: number
    returnable?: boolean
    position?: number
}

/** Weight items sell in gram steps (500 g, 100 g, 1 g by default); everything else by one. */
function validStep(unit: Unit, step: number | undefined): number {
    if (!isWeightUnit(unit)) {
        return 1
    }
    const min = unit === Unit.GRAM ? 1 : MIN_WEIGHT_STEP
    return requireInteger("step", step ?? defaultStep(unit), min, MAX_WEIGHT_STEP)
}

function validPrice(amount: number): Money {
    return Money.of(requireInteger("price", amount, 1, MAX_PRICE))
}

export class Product {
    private constructor(private props: ProductProps) {}

    static create(input: CreateProductProps): Product {
        const now = new Date()
        const unit = requireOneOf("unit", input.unit, UNITS)
        return new Product({
            id: input.id,
            businessId: input.businessId,
            name: requireText("name", input.name, NAME_MAX),
            description: optionalText("description", input.description, DESCRIPTION_MAX),
            price: validPrice(input.price),
            unit,
            step: validStep(unit, input.step),
            category: requireOneOf("category", input.category, CATEGORIES),
            isAvailable: true,
            returnable: input.returnable ?? false,
            position: requireInteger("position", input.position ?? 0, 0, MAX_POSITION),
            createdAt: now,
            updatedAt: now,
        })
    }

    static reconstitute(props: ProductProps): Product {
        return new Product({ ...props })
    }

    get id(): string {
        return this.props.id
    }
    get businessId(): string {
        return this.props.businessId
    }
    get name(): string {
        return this.props.name
    }
    get description(): string | undefined {
        return this.props.description
    }
    get price(): Money {
        return this.props.price
    }
    get unit(): Unit {
        return this.props.unit
    }
    get step(): number {
        return this.props.step
    }
    /** Name and description in one search spelling (see `searchText`). */
    get searchText(): string {
        return searchText(this.props.name, this.props.description)
    }
    get unavailableUntil(): Date | undefined {
        return this.props.unavailableUntil
    }
    get returnable(): boolean {
        return this.props.returnable
    }
    get category(): Category {
        return this.props.category
    }
    get imageKey(): string | undefined {
        return this.props.imageKey
    }
    get isAvailable(): boolean {
        return this.props.isAvailable
    }
    get position(): number {
        return this.props.position
    }
    get createdAt(): Date {
        return this.props.createdAt
    }
    get updatedAt(): Date {
        return this.props.updatedAt
    }

    belongsTo(businessId: string): boolean {
        return this.props.businessId === businessId
    }

    /** On sale right now: not hidden and not on today's stop-list. */
    isAvailableAt(now: Date): boolean {
        const until = this.props.unavailableUntil
        return this.props.isAvailable && (until === undefined || now >= until)
    }

    /** Checks an ordered quantity (base units) against the selling step. */
    assertQuantity(quantity: number): void {
        const { step } = this.props
        requireInteger("quantity", quantity, step, step * MAX_STEPS_PER_LINE)
        if (quantity % step !== 0) {
            throw ValidationError.fromField("quantity", `Must be a multiple of ${step}`, quantity)
        }
    }

    update(patch: ProductPatch): void {
        if (patch.name !== undefined) {
            this.props.name = requireText("name", patch.name, NAME_MAX)
        }
        if (patch.description !== undefined) {
            this.props.description = optionalText("description", patch.description, DESCRIPTION_MAX)
        }
        if (patch.price !== undefined) {
            this.props.price = validPrice(patch.price)
        }
        if (patch.unit !== undefined) {
            this.props.unit = requireOneOf("unit", patch.unit, UNITS)
        }
        if (patch.unit !== undefined || patch.step !== undefined) {
            const keepStep = isWeightUnit(this.props.unit) && this.props.step > 1
            this.props.step = validStep(
                this.props.unit,
                patch.step ?? (keepStep ? this.props.step : undefined),
            )
        }
        if (patch.returnable !== undefined) {
            this.props.returnable = patch.returnable
        }
        if (patch.category !== undefined) {
            this.props.category = requireOneOf("category", patch.category, CATEGORIES)
        }
        if (patch.position !== undefined) {
            this.props.position = requireInteger("position", patch.position, 0, MAX_POSITION)
        }
        this.touch()
    }

    /** Hide or show for good. Clears today's stop-list mark. */
    setAvailability(isAvailable: boolean): void {
        this.props.isAvailable = isAvailable
        this.props.unavailableUntil = undefined
        this.touch()
    }

    /** "Sold out today": hidden until the next midnight in Tashkent, then back by itself. */
    stopForToday(now: Date): void {
        this.props.isAvailable = true
        this.props.unavailableUntil = addDays(startOfLocalDay(now), 1)
        this.touch()
    }

    setImage(imageKey: string | null): void {
        this.props.imageKey = imageKey ?? undefined
        this.touch()
    }

    private touch(): void {
        this.props.updatedAt = new Date()
    }
}

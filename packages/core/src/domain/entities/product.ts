import { AGES, isAge } from "../enums/age.js"
import { CATEGORIES, MAX_CATEGORIES } from "../enums/category.js"
import { UNITS, Unit, defaultStep, isWeightUnit } from "../enums/unit.js"
import { BusinessRuleViolationError } from "../errors/business-rule.error.js"
import { EntityNotFoundError } from "../errors/not-found.error.js"
import { ValidationError } from "../errors/validation.error.js"
import { optionalText, requireInteger, requireOneOf, requireText } from "../shared/guards.js"
import { searchText } from "../shared/search-text.js"
import { addDays, startOfLocalDay } from "../shared/time.js"
import { Money } from "../value-objects/money.js"
import { ProductOptions } from "../value-objects/product-options.js"

import type { Age } from "../enums/age.js"
import type { Category } from "../enums/category.js"
import type {
    ChosenOptions,
    OptionChoice,
    ProductOptionsProps,
} from "../value-objects/product-options.js"

const NAME_MAX = 80
const DESCRIPTION_MAX = 500
const MAX_PRICE = 100_000_000
const MAX_POSITION = 100_000
/** A line holds at most 99 steps: 99 pieces, or 49.5 kg with a 500 g step. */
const MAX_STEPS_PER_LINE = 99
/** Weight steps: 10 g to 10 kg, or a single gram for goods priced per gram (saffron). */
const MIN_WEIGHT_STEP = 10
const MAX_WEIGHT_STEP = 10_000
/** The most a shop may count of one product, in base units: ten million pieces, or 10 t. */
const MAX_STOCK = 10_000_000
/** Photos of one product (owner's decision, November 2026): the main one and two more. */
export const MAX_PHOTOS = 3
/**
 * «Yangi kelganlar» (owner's decision, November 2026; goal 24): a product is new this many days
 * after the owner added it.
 */
export const NEW_PRODUCT_DAYS = 30

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
    /** Further categories it also stands in on the storefront (the main one goes in orders). */
    moreCategories?: Category[]
    /** The child's age it is for, from this many years (children's goods). */
    ageFrom?: Age
    /** The main photo: the menu, the showcase and the owner's catalog show it. */
    imageKey?: string
    /** Up to two more photos, after the main one, for the product's own sheet. */
    moreImageKeys?: string[]
    isAvailable: boolean
    /** Stop-list: hidden until this moment (the next local midnight), then back on sale. */
    unavailableUntil?: Date
    /** A returnable container, e.g. a 19 l water bottle with a deposit. */
    returnable: boolean
    position: number
    /** Variants (one is picked, each with its price) and add-ons; none for most products. */
    options?: ProductOptions
    /**
     * What is left, when the owner counts it (owner's decision, November 2026), in the order's
     * base units: pieces, or grams for weight units. Absent: not counted, sold as before.
     */
    stock?: number
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
    moreCategories?: readonly string[] | null
    ageFrom?: number | null
    step?: number
    returnable?: boolean
    position?: number
    options?: ProductOptionsProps | null
    /** null or absent: not counted. */
    stock?: number | null
}

export interface ProductPatch {
    name?: string
    description?: string | null
    price?: number
    unit?: string
    category?: string
    /** null or [] leaves only the main category. */
    moreCategories?: readonly string[] | null
    /** null: no age. */
    ageFrom?: number | null
    step?: number
    returnable?: boolean
    position?: number
    /** null drops every variant and add-on. */
    options?: ProductOptionsProps | null
    /** A new count of what is left; null stops counting. */
    stock?: number | null
}

/** Weight items sell in gram steps (500 g, 100 g, 1 g by default); everything else by one. */
function validStep(unit: Unit, step: number | undefined): number {
    if (!isWeightUnit(unit)) {
        return 1
    }
    const min = unit === Unit.GRAM ? 1 : MIN_WEIGHT_STEP
    return requireInteger("step", step ?? defaultStep(unit), min, MAX_WEIGHT_STEP)
}

/**
 * Variants and add-ons, checked against the unit: a weight item sells by the gram, so it takes
 * variants (kinds of rice) but no add-ons. Empty options are no options.
 */
function validOptions(
    unit: Unit,
    input: ProductOptionsProps | null | undefined,
): ProductOptions | undefined {
    if (!input) {
        return undefined
    }
    const options = ProductOptions.create(input)
    if (isWeightUnit(unit) && options.addons.length > 0) {
        throw ValidationError.fromField("addons", "A weight item takes no add-ons", unit)
    }
    return options.isEmpty ? undefined : options
}

/** The categories besides the main one: known ones, each once, never the main one again. */
function validMoreCategories(
    main: Category,
    input: readonly string[] | null | undefined,
): Category[] | undefined {
    if (!input || input.length === 0) {
        return undefined
    }
    if (input.length > MAX_CATEGORIES - 1) {
        throw ValidationError.fromField(
            "moreCategories",
            `At most ${MAX_CATEGORIES} categories in all`,
            input.length,
        )
    }
    const more = input.map((category) => requireOneOf("moreCategories", category, CATEGORIES))
    if (new Set([main, ...more]).size !== more.length + 1) {
        throw ValidationError.fromField("moreCategories", "Each category once", input.join(","))
    }
    return more
}

function validAge(input: number | null | undefined): Age | undefined {
    if (input === null || input === undefined) {
        return undefined
    }
    if (!isAge(input)) {
        throw ValidationError.fromField("ageFrom", `Must be one of: ${AGES.join(", ")}`, input)
    }
    return input
}

function validPrice(amount: number): Money {
    return Money.of(requireInteger("price", amount, 1, MAX_PRICE))
}

function validStock(input: number | null | undefined): number | undefined {
    return input === null || input === undefined
        ? undefined
        : requireInteger("stock", input, 0, MAX_STOCK)
}

export class Product {
    /**
     * The owner set the count in this change: only then is it written over the stored one, which
     * the orders change meanwhile (`stock = stock - ?`). A plain edit never brings an old count back.
     */
    private stockSet = false

    private constructor(private props: ProductProps) {}

    static create(input: CreateProductProps): Product {
        const now = new Date()
        const unit = requireOneOf("unit", input.unit, UNITS)
        const options = validOptions(unit, input.options)
        const category = requireOneOf("category", input.category, CATEGORIES)
        const product = new Product({
            id: input.id,
            businessId: input.businessId,
            name: requireText("name", input.name, NAME_MAX),
            description: optionalText("description", input.description, DESCRIPTION_MAX),
            // With variants the product costs as its cheapest variant («… so'm dan»).
            price: validPrice(options?.lowestPrice ?? input.price),
            unit,
            step: validStep(unit, input.step),
            category,
            moreCategories: validMoreCategories(category, input.moreCategories),
            ageFrom: validAge(input.ageFrom),
            isAvailable: true,
            returnable: input.returnable ?? false,
            position: requireInteger("position", input.position ?? 0, 0, MAX_POSITION),
            options,
            stock: validStock(input.stock),
            createdAt: now,
            updatedAt: now,
        })
        product.stockSet = product.tracksStock
        return product
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
    /** The main category: the one an order line keeps. */
    get category(): Category {
        return this.props.category
    }
    get moreCategories(): Category[] {
        return this.props.moreCategories ?? []
    }
    /** Every category it stands in: the main one first. */
    get categories(): Category[] {
        return [this.props.category, ...this.moreCategories]
    }
    get ageFrom(): Age | undefined {
        return this.props.ageFrom
    }
    get imageKey(): string | undefined {
        return this.props.imageKey
    }
    get moreImageKeys(): string[] {
        return this.props.moreImageKeys ?? []
    }
    /** Every photo, the main one first. */
    get photos(): string[] {
        return this.props.imageKey ? [this.props.imageKey, ...this.moreImageKeys] : []
    }
    get isAvailable(): boolean {
        return this.props.isAvailable
    }
    get position(): number {
        return this.props.position
    }
    get options(): ProductOptions | undefined {
        return this.props.options
    }
    /** What is left in base units, when the owner counts it. */
    get stock(): number | undefined {
        return this.props.stock
    }
    get tracksStock(): boolean {
        return this.props.stock !== undefined
    }
    /**
     * Counted and less than one selling step left: the customer still sees it, but cannot add it
     * (owner's decision, November 2026).
     */
    get soldOut(): boolean {
        return this.props.stock !== undefined && this.props.stock < this.props.step
    }
    /** The owner gave a new count in this change (see `stockSet`). */
    get stockChanged(): boolean {
        return this.stockSet
    }
    get createdAt(): Date {
        return this.props.createdAt
    }
    /**
     * Added within `NEW_PRODUCT_DAYS` of `now`, on the server's clock: a phone set to the wrong
     * day never decides what is new.
     */
    isNewAt(now: Date): boolean {
        return now.getTime() < addDays(this.props.createdAt, NEW_PRODUCT_DAYS).getTime()
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

    /**
     * Orders took (`delta` < 0) or gave back what is counted. The database does it in one
     * statement (`stock = stock + ?`); this is the same for a copy kept in memory.
     */
    changeStockBy(delta: number): void {
        if (this.props.stock !== undefined) {
            this.props.stock = Math.max(0, this.props.stock + delta)
        }
    }

    /** Everything ordered of it in one order (base units) must be left, when it is counted. */
    assertInStock(quantity: number): void {
        const left = this.props.stock
        if (left !== undefined && quantity > left) {
            throw BusinessRuleViolationError.outOfStock(this.props.id, left)
        }
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
        this.applyCategories(patch)
        if (patch.ageFrom !== undefined) {
            this.props.ageFrom = validAge(patch.ageFrom)
        }
        if (patch.position !== undefined) {
            this.props.position = requireInteger("position", patch.position, 0, MAX_POSITION)
        }
        this.applyOptions(patch)
        if (patch.stock !== undefined) {
            this.props.stock = validStock(patch.stock)
            this.stockSet = true
        }
        this.touch()
    }

    /**
     * A new main category, new further ones, or both. A main category that was a further one
     * leaves the further ones by itself: the owner moved it, not doubled it.
     */
    private applyCategories(patch: ProductPatch): void {
        if (patch.category === undefined && patch.moreCategories === undefined) {
            return
        }
        const main =
            patch.category === undefined
                ? this.props.category
                : requireOneOf("category", patch.category, CATEGORIES)
        const more =
            patch.moreCategories === undefined
                ? this.moreCategories.filter((category) => category !== main)
                : patch.moreCategories
        this.props.category = main
        this.props.moreCategories = validMoreCategories(main, more)
    }

    /** New variants and add-ons, or the old ones checked again against a new unit. */
    private applyOptions(patch: ProductPatch): void {
        if (patch.options !== undefined || patch.unit !== undefined) {
            const next = patch.options !== undefined ? patch.options : this.props.options?.toJSON()
            this.props.options = validOptions(this.props.unit, next)
        }
        const lowest = this.props.options?.lowestPrice
        if (lowest !== undefined) {
            this.props.price = validPrice(lowest)
        }
    }

    /**
     * The price of one unit for the customer's pick, with the words for the order line. Throws
     * when a variant is needed and missing, or when an id is not this product's.
     */
    priceFor(choice: OptionChoice): { unitPrice: Money; chosen?: ChosenOptions } {
        const options = this.props.options
        if (!options) {
            if (choice.variantId || (choice.addonIds?.length ?? 0) > 0) {
                throw BusinessRuleViolationError.optionUnavailable(this.props.id)
            }
            return { unitPrice: this.props.price }
        }
        if (options.hasVariants && !choice.variantId) {
            throw BusinessRuleViolationError.variantRequired(this.props.id)
        }
        const priced = options.price(this.props.price, choice)
        if (!priced) {
            throw BusinessRuleViolationError.optionUnavailable(this.props.id)
        }
        return priced
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

    /**
     * A new main photo, or none: then the next photo, if any, becomes the main one. Returns the
     * main photo it replaced, for the storage to delete.
     */
    setImage(imageKey: string | null): string | undefined {
        const previous = this.props.imageKey
        if (imageKey !== null) {
            this.props.imageKey = imageKey
        } else {
            this.setPhotos(this.moreImageKeys)
        }
        this.touch()
        return previous
    }

    /** One more photo: the main one when there is none, after the others otherwise. */
    addPhoto(key: string): void {
        if (this.photos.includes(key)) {
            return
        }
        if (this.photos.length >= MAX_PHOTOS) {
            throw BusinessRuleViolationError.tooManyPhotos(MAX_PHOTOS)
        }
        this.setPhotos([...this.photos, key])
        this.touch()
    }

    /** Takes one photo away; the next one becomes the main photo when it was the main one. */
    removePhoto(key: string): void {
        if (!this.photos.includes(key)) {
            throw EntityNotFoundError.photo(key)
        }
        this.setPhotos(this.photos.filter((photo) => photo !== key))
        this.touch()
    }

    /** The same photos in a new order: the first is the main one. */
    reorderPhotos(keys: readonly string[]): void {
        const now = [...this.photos].sort()
        if (keys.length !== now.length || [...keys].sort().some((key, i) => key !== now[i])) {
            throw ValidationError.fromField("keys", "Must be this product's photos", keys.join(","))
        }
        this.setPhotos([...keys])
        this.touch()
    }

    private setPhotos(keys: readonly string[]): void {
        const [main, ...more] = keys
        this.props.imageKey = main
        this.props.moreImageKeys = more.length > 0 ? more : undefined
    }

    private touch(): void {
        this.props.updatedAt = new Date()
    }
}

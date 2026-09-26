import { CATEGORIES } from "../enums/category.js"
import { UNITS } from "../enums/unit.js"
import { optionalText, requireInteger, requireOneOf, requireText } from "../shared/guards.js"
import { Money } from "../value-objects/money.js"

import type { Category } from "../enums/category.js"
import type { Unit } from "../enums/unit.js"

const NAME_MAX = 80
const DESCRIPTION_MAX = 500
const MAX_PRICE = 100_000_000
const MAX_POSITION = 100_000

export interface ProductProps {
    id: string
    businessId: string
    name: string
    description?: string
    price: Money
    unit: Unit
    category: Category
    imageKey?: string
    isAvailable: boolean
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
    position?: number
}

export interface ProductPatch {
    name?: string
    description?: string | null
    price?: number
    unit?: string
    category?: string
    position?: number
}

function validPrice(amount: number): Money {
    return Money.of(requireInteger("price", amount, 1, MAX_PRICE))
}

export class Product {
    private constructor(private props: ProductProps) {}

    static create(input: CreateProductProps): Product {
        const now = new Date()
        return new Product({
            id: input.id,
            businessId: input.businessId,
            name: requireText("name", input.name, NAME_MAX),
            description: optionalText("description", input.description, DESCRIPTION_MAX),
            price: validPrice(input.price),
            unit: requireOneOf("unit", input.unit, UNITS),
            category: requireOneOf("category", input.category, CATEGORIES),
            isAvailable: true,
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
        if (patch.category !== undefined) {
            this.props.category = requireOneOf("category", patch.category, CATEGORIES)
        }
        if (patch.position !== undefined) {
            this.props.position = requireInteger("position", patch.position, 0, MAX_POSITION)
        }
        this.touch()
    }

    setAvailability(isAvailable: boolean): void {
        this.props.isAvailable = isAvailable
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

import { Money } from "../value-objects/money.js"

export interface ProductProps {
    id: string
    businessId: string
    name: string
    description: string
    price: Money
    category: string
    imageUrl: string | undefined
    isAvailable: boolean
    createdAt: Date
    updatedAt: Date
}

export class Product {
    private constructor(private props: ProductProps) {}

    static create(props: Omit<ProductProps, "createdAt" | "updatedAt" | "isAvailable">): Product {
        const now = new Date()
        return new Product({
            ...props,
            isAvailable: true,
            createdAt: now,
            updatedAt: now,
        })
    }

    static reconstitute(props: ProductProps): Product {
        return new Product(props)
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

    get description(): string {
        return this.props.description
    }

    get price(): Money {
        return this.props.price
    }

    get category(): string {
        return this.props.category
    }

    get imageUrl(): string | undefined {
        return this.props.imageUrl
    }

    get isAvailable(): boolean {
        return this.props.isAvailable
    }

    get createdAt(): Date {
        return this.props.createdAt
    }

    get updatedAt(): Date {
        return this.props.updatedAt
    }

    updateDetails(name: string, description: string, category: string): void {
        if (!name.trim()) {
            throw new Error("Product name is required")
        }
        this.props.name = name.trim()
        this.props.description = description.trim()
        this.props.category = category.trim()
        this.props.updatedAt = new Date()
    }

    updatePrice(price: Money): void {
        if (price.amount <= 0) {
            throw new Error("Product price must be positive")
        }
        this.props.price = price
        this.props.updatedAt = new Date()
    }

    updateImage(imageUrl: string | undefined): void {
        this.props.imageUrl = imageUrl
        this.props.updatedAt = new Date()
    }

    markAvailable(): void {
        this.props.isAvailable = true
        this.props.updatedAt = new Date()
    }

    markUnavailable(): void {
        this.props.isAvailable = false
        this.props.updatedAt = new Date()
    }

    toJSON(): ProductProps {
        return { ...this.props }
    }
}

import { Money } from "../value-objects/money.js"

export interface OrderItemProps {
    id: string
    productId: string
    productName: string
    quantity: number
    unitPrice: Money
}

export class OrderItem {
    private constructor(private props: OrderItemProps) {}

    static create(props: OrderItemProps): OrderItem {
        if (props.quantity <= 0) {
            throw new Error("Quantity must be positive")
        }
        return new OrderItem(props)
    }

    get id(): string {
        return this.props.id
    }

    get productId(): string {
        return this.props.productId
    }

    get productName(): string {
        return this.props.productName
    }

    get quantity(): number {
        return this.props.quantity
    }

    get unitPrice(): Money {
        return this.props.unitPrice
    }

    get total(): Money {
        return this.props.unitPrice.multiply(this.props.quantity)
    }

    updateQuantity(quantity: number): void {
        if (quantity <= 0) {
            throw new Error("Quantity must be positive")
        }
        this.props.quantity = quantity
    }

    toJSON(): OrderItemProps {
        return { ...this.props }
    }
}

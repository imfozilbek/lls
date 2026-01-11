import { OrderStatus, canTransitionTo } from "../enums/order-status.js"
import { Address } from "../value-objects/address.js"
import { Money } from "../value-objects/money.js"

import { OrderItem } from "./order-item.js"

export interface OrderProps {
    id: string
    customerId: string
    businessId: string
    courierId: string | undefined
    items: OrderItem[]
    deliveryAddress: Address
    status: OrderStatus
    total: Money
    createdAt: Date
    updatedAt: Date
}

export class Order {
    private constructor(private props: OrderProps) {}

    static create(
        props: Omit<OrderProps, "status" | "total" | "createdAt" | "updatedAt" | "courierId">,
    ): Order {
        if (props.items.length === 0) {
            throw new Error("Order must have at least one item")
        }

        const total = props.items.reduce((sum, item) => sum.add(item.total), Money.zero())

        const now = new Date()
        return new Order({
            ...props,
            status: OrderStatus.PENDING,
            total,
            courierId: undefined,
            createdAt: now,
            updatedAt: now,
        })
    }

    static reconstitute(props: OrderProps): Order {
        return new Order(props)
    }

    get id(): string {
        return this.props.id
    }

    get customerId(): string {
        return this.props.customerId
    }

    get businessId(): string {
        return this.props.businessId
    }

    get courierId(): string | undefined {
        return this.props.courierId
    }

    get items(): OrderItem[] {
        return [...this.props.items]
    }

    get deliveryAddress(): Address {
        return this.props.deliveryAddress
    }

    get status(): OrderStatus {
        return this.props.status
    }

    get total(): Money {
        return this.props.total
    }

    get createdAt(): Date {
        return this.props.createdAt
    }

    get updatedAt(): Date {
        return this.props.updatedAt
    }

    transitionTo(newStatus: OrderStatus): void {
        if (!canTransitionTo(this.props.status, newStatus)) {
            throw new Error(`Cannot transition from ${this.props.status} to ${newStatus}`)
        }
        this.props.status = newStatus
        this.props.updatedAt = new Date()
    }

    accept(): void {
        this.transitionTo(OrderStatus.ACCEPTED)
    }

    startPreparing(): void {
        this.transitionTo(OrderStatus.PREPARING)
    }

    markReady(): void {
        this.transitionTo(OrderStatus.READY)
    }

    assignCourier(courierId: string): void {
        if (this.props.courierId) {
            throw new Error("Order already has a courier assigned")
        }
        this.props.courierId = courierId
        this.props.updatedAt = new Date()
    }

    pickup(): void {
        if (!this.props.courierId) {
            throw new Error("Cannot pickup order without courier")
        }
        this.transitionTo(OrderStatus.PICKED_UP)
    }

    deliver(): void {
        this.transitionTo(OrderStatus.DELIVERED)
    }

    cancel(): void {
        this.transitionTo(OrderStatus.CANCELLED)
    }

    isPending(): boolean {
        return this.props.status === OrderStatus.PENDING
    }

    isActive(): boolean {
        return ![OrderStatus.DELIVERED, OrderStatus.CANCELLED].includes(this.props.status)
    }

    isCompleted(): boolean {
        return this.props.status === OrderStatus.DELIVERED
    }

    isCancelled(): boolean {
        return this.props.status === OrderStatus.CANCELLED
    }

    toJSON(): OrderProps {
        return {
            ...this.props,
            items: this.props.items.map((item) => item.toJSON() as unknown as OrderItem),
        }
    }
}

import {
    OrderStatus,
    canTransitionTo,
    getNextStatus,
    isFinalStatus,
} from "../enums/order-status.js"
import { BusinessRuleViolationError } from "../errors/business-rule.error.js"
import { InvalidOrderTransitionError } from "../errors/invalid-transition.error.js"
import { ValidationError } from "../errors/validation.error.js"
import { optionalText, requireInteger, requireText } from "../shared/guards.js"
import { Money } from "../value-objects/money.js"

import type { OrderItem } from "./order-item.js"
import type { Location } from "../value-objects/location.js"
import type { Phone } from "../value-objects/phone.js"

export const MAX_ORDER_LINES = 50
const ADDRESS_MAX = 200
const LANDMARK_MAX = 200
const COMMENT_MAX = 300
const REASON_MAX = 200

export type CancelledBy = "customer" | "owner"

export interface OrderProps {
    id: string
    businessId: string
    customerId: string
    number: number
    items: readonly OrderItem[]
    subtotal: Money
    deliveryFee: Money
    total: Money
    status: OrderStatus
    address: string
    landmark?: string
    location?: Location
    comment?: string
    customerName: string
    customerPhone?: Phone
    cancelReason?: string
    cancelledBy?: CancelledBy
    createdAt: Date
    updatedAt: Date
}

export interface PlaceOrderProps {
    id: string
    businessId: string
    customerId: string
    number: number
    items: OrderItem[]
    deliveryFee: Money
    address: string
    landmark?: string
    location?: Location
    comment?: string
    customerName: string
    customerPhone?: Phone
}

export function subtotalOf(items: readonly OrderItem[]): Money {
    return items.reduce((sum, item) => sum.add(item.total), Money.zero())
}

export class Order {
    private constructor(private props: OrderProps) {}

    static place(input: PlaceOrderProps): Order {
        if (input.items.length === 0) {
            throw BusinessRuleViolationError.emptyOrder()
        }
        if (input.items.length > MAX_ORDER_LINES) {
            throw BusinessRuleViolationError.tooManyItems(MAX_ORDER_LINES)
        }
        const subtotal = subtotalOf(input.items)
        const now = new Date()
        return new Order({
            id: input.id,
            businessId: input.businessId,
            customerId: input.customerId,
            number: requireInteger("number", input.number, 1, Number.MAX_SAFE_INTEGER),
            items: [...input.items],
            subtotal,
            deliveryFee: input.deliveryFee,
            total: subtotal.add(input.deliveryFee),
            status: OrderStatus.PENDING,
            address: requireText("address", input.address, ADDRESS_MAX),
            landmark: optionalText("landmark", input.landmark, LANDMARK_MAX),
            location: input.location,
            comment: optionalText("comment", input.comment, COMMENT_MAX),
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            createdAt: now,
            updatedAt: now,
        })
    }

    static reconstitute(props: OrderProps): Order {
        return new Order({ ...props, items: [...props.items] })
    }

    get id(): string {
        return this.props.id
    }
    get businessId(): string {
        return this.props.businessId
    }
    get customerId(): string {
        return this.props.customerId
    }
    get number(): number {
        return this.props.number
    }
    get items(): readonly OrderItem[] {
        return this.props.items
    }
    get subtotal(): Money {
        return this.props.subtotal
    }
    get deliveryFee(): Money {
        return this.props.deliveryFee
    }
    get total(): Money {
        return this.props.total
    }
    get status(): OrderStatus {
        return this.props.status
    }
    get address(): string {
        return this.props.address
    }
    get landmark(): string | undefined {
        return this.props.landmark
    }
    get location(): Location | undefined {
        return this.props.location
    }
    get comment(): string | undefined {
        return this.props.comment
    }
    get customerName(): string {
        return this.props.customerName
    }
    get customerPhone(): Phone | undefined {
        return this.props.customerPhone
    }
    get cancelReason(): string | undefined {
        return this.props.cancelReason
    }
    get cancelledBy(): CancelledBy | undefined {
        return this.props.cancelledBy
    }
    get createdAt(): Date {
        return this.props.createdAt
    }
    get updatedAt(): Date {
        return this.props.updatedAt
    }

    isPlacedBy(customerId: string): boolean {
        return this.props.customerId === customerId
    }

    isFinal(): boolean {
        return isFinalStatus(this.props.status)
    }

    nextStatus(): OrderStatus | null {
        return getNextStatus(this.props.status)
    }

    /** Owner moves the order forward. Cancelling goes through `cancel()`. */
    advanceTo(status: OrderStatus): void {
        if (status === OrderStatus.CANCELLED) {
            throw ValidationError.fromField("status", "Use cancel() to cancel an order", status)
        }
        if (!canTransitionTo(this.props.status, status)) {
            throw new InvalidOrderTransitionError(this.props.id, this.props.status, status)
        }
        this.props.status = status
        this.touch()
    }

    /** A customer may cancel only while the order is pending. The owner may cancel any active order. */
    cancel(by: CancelledBy, reason?: string): void {
        if (by === "customer" && this.props.status !== OrderStatus.PENDING) {
            throw BusinessRuleViolationError.orderCannotBeCancelled(
                this.props.id,
                this.props.status,
            )
        }
        if (!canTransitionTo(this.props.status, OrderStatus.CANCELLED)) {
            throw new InvalidOrderTransitionError(
                this.props.id,
                this.props.status,
                OrderStatus.CANCELLED,
            )
        }
        this.props.status = OrderStatus.CANCELLED
        this.props.cancelledBy = by
        this.props.cancelReason = optionalText("cancelReason", reason, REASON_MAX)
        this.touch()
    }

    private touch(): void {
        this.props.updatedAt = new Date()
    }
}

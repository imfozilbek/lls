import {
    OrderStatus,
    canActorMove,
    canTransitionTo,
    getNextStatus,
    isFinalStatus,
} from "../enums/order-status.js"
import { BusinessRuleViolationError } from "../errors/business-rule.error.js"
import { ForbiddenError } from "../errors/forbidden.error.js"
import { InvalidOrderTransitionError } from "../errors/invalid-transition.error.js"
import { ValidationError } from "../errors/validation.error.js"
import { optionalText, requireInteger, requireText } from "../shared/guards.js"
import { Money } from "../value-objects/money.js"

import type { Courier } from "./courier.js"
import type { OrderItem } from "./order-item.js"
import type { OrderChannel } from "../enums/order-channel.js"
import type { Location } from "../value-objects/location.js"
import type { Phone } from "../value-objects/phone.js"

export const MAX_ORDER_LINES = 50
const ADDRESS_MAX = 200
const LANDMARK_MAX = 200
const COMMENT_MAX = 300
const REASON_MAX = 200
const MAX_BOTTLES_RETURNED = 99

export type CancelledBy = "customer" | "owner"

/** Who moves the order forward: the owner, or the courier the order is assigned to. */
export type OrderMover = { role: "owner" } | { role: "courier"; courierId: string }

const OWNER: OrderMover = { role: "owner" }

/** A courier can take the order from the moment the shop accepted it until pickup. */
const ASSIGNABLE: readonly OrderStatus[] = [
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
]

export interface OrderProps {
    id: string
    businessId: string
    customerId: string
    number: number
    channel: OrderChannel
    items: readonly OrderItem[]
    subtotal: Money
    deliveryFee: Money
    /** Deposit for returnable bottles the customer keeps. */
    depositTotal: Money
    bottlesReturned: number
    total: Money
    /** Snapshot of the LLS commission at placement: rate and amount on the goods subtotal. */
    commissionBps: number
    commission: Money
    status: OrderStatus
    courierId?: string
    courierName?: string
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
    channel: OrderChannel
    items: OrderItem[]
    deliveryFee: Money
    depositTotal?: Money
    bottlesReturned?: number
    commissionBps: number
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
        const depositTotal = input.depositTotal ?? Money.zero()
        const now = new Date()
        return new Order({
            id: input.id,
            businessId: input.businessId,
            customerId: input.customerId,
            number: requireInteger("number", input.number, 1, Number.MAX_SAFE_INTEGER),
            channel: input.channel,
            items: [...input.items],
            subtotal,
            deliveryFee: input.deliveryFee,
            depositTotal,
            bottlesReturned: requireInteger(
                "bottlesReturned",
                input.bottlesReturned ?? 0,
                0,
                MAX_BOTTLES_RETURNED,
            ),
            total: subtotal.add(input.deliveryFee).add(depositTotal),
            // Commission is on goods only: never on delivery or bottle deposits.
            commissionBps: input.commissionBps,
            commission: subtotal.percent(input.commissionBps),
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
    get channel(): OrderChannel {
        return this.props.channel
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
    get depositTotal(): Money {
        return this.props.depositTotal
    }
    get bottlesReturned(): number {
        return this.props.bottlesReturned
    }
    get total(): Money {
        return this.props.total
    }
    get commissionBps(): number {
        return this.props.commissionBps
    }
    get commission(): Money {
        return this.props.commission
    }
    get courierId(): string | undefined {
        return this.props.courierId
    }
    get courierName(): string | undefined {
        return this.props.courierName
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

    isAssignedTo(courierId: string): boolean {
        return this.props.courierId === courierId
    }

    /**
     * Moves the order forward. The owner may make every step; a courier only the delivery part
     * of an order assigned to them. Cancelling goes through `cancel()`.
     */
    advanceTo(status: OrderStatus, by: OrderMover = OWNER): void {
        if (status === OrderStatus.CANCELLED) {
            throw ValidationError.fromField("status", "Use cancel() to cancel an order", status)
        }
        if (by.role === "courier" && !this.isAssignedTo(by.courierId)) {
            throw ForbiddenError.notAssignedCourier(this.props.id)
        }
        if (!canTransitionTo(this.props.status, status)) {
            throw new InvalidOrderTransitionError(this.props.id, this.props.status, status)
        }
        if (!canActorMove(by.role, this.props.status, status)) {
            throw ForbiddenError.stepNotAllowed(this.props.id, status)
        }
        this.props.status = status
        this.touch()
    }

    /** The owner hands the order to one of the shop's couriers (or to another one, before pickup). */
    assignCourier(courier: Courier): void {
        if (!ASSIGNABLE.includes(this.props.status)) {
            throw BusinessRuleViolationError.orderNotAssignable(this.props.id, this.props.status)
        }
        if (!courier.worksFor(this.props.businessId)) {
            throw BusinessRuleViolationError.courierNotAvailable(courier.id)
        }
        this.props.courierId = courier.id
        this.props.courierName = courier.name
        this.touch()
    }

    /** A customer may cancel only while the order is pending. The owner may cancel any active order. */
    cancel(by: CancelledBy, reason?: string): void {
        if (
            by === "customer" &&
            !canActorMove("customer", this.props.status, OrderStatus.CANCELLED)
        ) {
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

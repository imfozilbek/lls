import { DeliveryFeeRecipient, NETWORK_DELIVERY_FEE_RECIPIENT } from "../enums/delivery-fee.js"
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
import { Payment } from "../value-objects/payment.js"

import type { Courier, NetworkUnavailableReason } from "./courier.js"
import type { OrderItem } from "./order-item.js"
import type { OrderChannel } from "../enums/order-channel.js"
import type { Location } from "../value-objects/location.js"
import type { PayoutCard } from "../value-objects/payout-card.js"
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
    payment: Payment
    deliveredAt?: Date
    /** The shop handed the order to the district network; set until its own courier takes it. */
    networkRequestedAt?: Date
    /** The shop and admins were told nobody took it in time (told once). */
    networkAlertedAt?: Date
    /** Who gets the delivery fee: a snapshot, fixed when a courier takes the order. */
    deliveryFeeTo?: DeliveryFeeRecipient
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
    /** The shop's payment card shown to the customer: kept with the order. */
    paymentCard?: PayoutCard
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
            payment: Payment.start(input.paymentCard),
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
    get payment(): Payment {
        return this.props.payment
    }
    get deliveredAt(): Date | undefined {
        return this.props.deliveredAt
    }
    get networkRequestedAt(): Date | undefined {
        return this.props.networkRequestedAt
    }
    get networkAlertedAt(): Date | undefined {
        return this.props.networkAlertedAt
    }
    get deliveryFeeTo(): DeliveryFeeRecipient {
        return this.props.deliveryFeeTo ?? DeliveryFeeRecipient.BUSINESS
    }

    /** Waiting for a district network courier to press «Беру». */
    isWaitingForNetwork(): boolean {
        return (
            this.props.networkRequestedAt !== undefined &&
            this.props.courierId === undefined &&
            ASSIGNABLE.includes(this.props.status)
        )
    }

    /** Delivered (or being delivered) by a courier who took it from the district network. */
    isViaNetwork(): boolean {
        return this.props.networkRequestedAt !== undefined && this.props.courierId !== undefined
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
     * of an order assigned to them. Cancelling goes through `cancel()`. The shop starts only
     * after the transfer arrived: accepting an unpaid order is refused.
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
        if (status === OrderStatus.ACCEPTED && !this.props.payment.isPaid()) {
            throw BusinessRuleViolationError.paymentRequired(this.props.id)
        }
        if (status === OrderStatus.DELIVERED) {
            this.props.deliveredAt = new Date()
        }
        this.props.status = status
        this.touch()
    }

    /** «Я перевёл»: the customer says the transfer is sent; the owner checks the card. */
    markTransferSent(): void {
        this.props.payment = this.props.payment.markSent()
        this.touch()
    }

    /** The owner saw the transfer on the card. On a cancelled order it is owed back. */
    confirmPayment(): void {
        this.props.payment = this.props.payment.confirm(
            new Date(),
            this.props.status === OrderStatus.CANCELLED,
        )
        this.touch()
    }

    /** «Деньги пришли — принять»: the transfer arrived and the shop starts, in one tap. */
    confirmPaymentAndAccept(): void {
        this.confirmPayment()
        if (this.props.status === OrderStatus.PENDING) {
            this.advanceTo(OrderStatus.ACCEPTED)
        }
    }

    /** The owner gave the money of a cancelled order back. */
    markRefunded(): void {
        this.props.payment = this.props.payment.refund()
        this.touch()
    }

    /**
     * The owner hands the order to one of the shop's couriers (or to another one, before pickup).
     * Only a courier who works for this shop today and is on shift may get a new order.
     */
    assignCourier(courier: Courier, now: Date): void {
        if (!ASSIGNABLE.includes(this.props.status)) {
            throw BusinessRuleViolationError.orderNotAssignable(this.props.id, this.props.status)
        }
        const reason =
            courier.businessId === this.props.businessId
                ? courier.unavailableReason(now)
                : "not_approved"
        if (reason !== null) {
            throw BusinessRuleViolationError.courierNotAvailable(courier.id, reason)
        }
        this.props.courierId = courier.id
        this.props.courierName = courier.name
        // The shop's own courier takes it: the network no longer needs to.
        this.props.networkRequestedAt = undefined
        this.props.networkAlertedAt = undefined
        this.props.deliveryFeeTo = DeliveryFeeRecipient.BUSINESS
        this.touch()
    }

    /** No courier of its own is free: the free network couriers of the district may take it. */
    requestNetwork(now: Date): void {
        if (!ASSIGNABLE.includes(this.props.status) || this.props.courierId !== undefined) {
            throw BusinessRuleViolationError.orderNotAssignable(this.props.id, this.props.status)
        }
        this.props.networkRequestedAt ??= now
        this.touch()
    }

    /**
     * A district network courier pressed «Беру». The first one wins: the repository saves it only
     * if nobody took the order in between.
     */
    claimByNetwork(link: Courier, now: Date, busy: boolean): void {
        if (!this.isWaitingForNetwork() || link.businessId !== this.props.businessId) {
            throw BusinessRuleViolationError.networkOrderTaken(this.props.id)
        }
        const reason = networkUnavailableReason(link, now, busy)
        if (reason !== null) {
            throw BusinessRuleViolationError.courierNotAvailable(link.id, reason)
        }
        this.props.courierId = link.id
        this.props.courierName = link.name
        this.props.deliveryFeeTo = NETWORK_DELIVERY_FEE_RECIPIENT
        this.touch()
    }

    /** Nobody took it in time: the shop and admins were told. */
    markNetworkAlerted(now: Date): void {
        this.props.networkAlertedAt = now
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
        this.props.payment = this.props.payment.onCancel()
        this.props.cancelledBy = by
        this.props.cancelReason = optionalText("cancelReason", reason, REASON_MAX)
        this.touch()
    }

    private touch(): void {
        this.props.updatedAt = new Date()
    }
}

/** Why this person cannot take a network order of the link's shop now, or null. */
export function networkUnavailableReason(
    link: Courier,
    now: Date,
    busy: boolean,
): NetworkUnavailableReason | null {
    if (!link.isActive && !link.isNetwork) {
        return "not_approved"
    }
    if (!link.profile.inNetwork) {
        return "not_in_network"
    }
    if (!link.profile.isOnShift(now)) {
        return "not_on_shift"
    }
    return busy ? "busy" : null
}

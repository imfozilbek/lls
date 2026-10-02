import { PaidWith, PaymentMethod, PaymentStatus } from "../enums/payment.js"
import { BusinessRuleViolationError } from "../errors/business-rule.error.js"

/** Who holds the cash of an order: the courier who took it, or the owner. */
export type CashHolder = { kind: "courier"; courierId: string } | { kind: "owner" }

export interface PaymentProps {
    method: PaymentMethod
    status: PaymentStatus
    paidAt?: Date
    /** The courier who took this order's cash at the door; it counts towards their cash on hand. */
    cashCourierId?: string
}

/**
 * The money side of an order. Immutable: every change returns a new Payment.
 * The one place for payment rules.
 */
export class Payment {
    private constructor(private readonly props: PaymentProps) {}

    /** At checkout. A transfer is awaited from the start: the customer may send it before delivery. */
    static start(method: PaymentMethod): Payment {
        return new Payment({
            method,
            status:
                method === PaymentMethod.CARD_TRANSFER
                    ? PaymentStatus.AWAITING
                    : PaymentStatus.UNPAID,
        })
    }

    static reconstitute(props: PaymentProps): Payment {
        return new Payment({ ...props })
    }

    get method(): PaymentMethod {
        return this.props.method
    }
    get status(): PaymentStatus {
        return this.props.status
    }
    get paidAt(): Date | undefined {
        return this.props.paidAt
    }
    get cashCourierId(): string | undefined {
        return this.props.cashCourierId
    }

    isPaid(): boolean {
        return this.props.status === PaymentStatus.PAID
    }

    /**
     * Delivered: how the customer paid at the door. Money already confirmed stays as it is.
     * Cash goes to whoever delivered: the courier holds it until handing it over.
     */
    settleOnDelivery(paidWith: PaidWith, holder: CashHolder, at: Date): Payment {
        if (this.isPaid()) {
            return this
        }
        switch (paidWith) {
            case PaidWith.CASH:
                return new Payment({
                    method: PaymentMethod.CASH,
                    status: PaymentStatus.PAID,
                    paidAt: at,
                    cashCourierId: holder.kind === "courier" ? holder.courierId : undefined,
                })
            case PaidWith.CARD_TRANSFER:
                return new Payment({
                    method: PaymentMethod.CARD_TRANSFER,
                    status: PaymentStatus.AWAITING,
                })
            case PaidWith.LATER:
                return new Payment({ method: this.props.method, status: PaymentStatus.UNPAID })
        }
    }

    /**
     * The owner saw the money: a transfer arrived, or a debt was paid (in cash to the owner,
     * or by transfer). Money for a cancelled order is owed back at once.
     */
    confirm(method: PaymentMethod, at: Date, orderCancelled: boolean): Payment {
        if (
            this.props.status !== PaymentStatus.UNPAID &&
            this.props.status !== PaymentStatus.AWAITING
        ) {
            throw BusinessRuleViolationError.paymentNotConfirmable(this.props.status)
        }
        return new Payment({
            method,
            status: orderCancelled ? PaymentStatus.REFUND_DUE : PaymentStatus.PAID,
            paidAt: at,
        })
    }

    /** The order was cancelled: paid money is owed back; an unconfirmed transfer is dropped. */
    onCancel(): Payment {
        if (this.isPaid()) {
            return new Payment({ ...this.props, status: PaymentStatus.REFUND_DUE })
        }
        return new Payment({ method: this.props.method, status: PaymentStatus.UNPAID })
    }

    /** The owner gave the money back. */
    refund(): Payment {
        if (this.props.status !== PaymentStatus.REFUND_DUE) {
            throw BusinessRuleViolationError.paymentNotRefundable(this.props.status)
        }
        return new Payment({ ...this.props, status: PaymentStatus.REFUNDED })
    }
}

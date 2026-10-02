import { PaymentMethod, PaymentStatus } from "../enums/payment.js"
import { BusinessRuleViolationError } from "../errors/business-rule.error.js"

export interface PaymentProps {
    method: PaymentMethod
    status: PaymentStatus
    paidAt?: Date
    /**
     * History only: orders paid in cash before payments became transfer-only. New orders never
     * set it.
     */
    cashCourierId?: string
}

/**
 * The money side of an order: a transfer to the shop's card, made before the shop starts.
 * Immutable: every change returns a new Payment. The one place for payment rules.
 */
export class Payment {
    private constructor(private readonly props: PaymentProps) {}

    /** At checkout: the customer will transfer to the shop's card; nothing has arrived yet. */
    static start(): Payment {
        return new Payment({ method: PaymentMethod.CARD_TRANSFER, status: PaymentStatus.UNPAID })
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

    /** «Я перевёл»: the owner should look at the card. Pressing it again changes nothing. */
    markSent(): Payment {
        if (this.props.status !== PaymentStatus.UNPAID) {
            return this
        }
        return new Payment({ ...this.props, status: PaymentStatus.AWAITING })
    }

    /** The owner saw the transfer arrive. Money for a cancelled order is owed back at once. */
    confirm(at: Date, orderCancelled: boolean): Payment {
        if (
            this.props.status !== PaymentStatus.UNPAID &&
            this.props.status !== PaymentStatus.AWAITING
        ) {
            throw BusinessRuleViolationError.paymentNotConfirmable(this.props.status)
        }
        return new Payment({
            method: PaymentMethod.CARD_TRANSFER,
            status: orderCancelled ? PaymentStatus.REFUND_DUE : PaymentStatus.PAID,
            paidAt: at,
        })
    }

    /**
     * The order was cancelled: paid money is owed back. A transfer the customer said they sent
     * stays awaited: if it arrives, the owner confirms it and it becomes owed back.
     */
    onCancel(): Payment {
        if (this.isPaid()) {
            return new Payment({ ...this.props, status: PaymentStatus.REFUND_DUE })
        }
        return this
    }

    /** The owner gave the money back. */
    refund(): Payment {
        if (this.props.status !== PaymentStatus.REFUND_DUE) {
            throw BusinessRuleViolationError.paymentNotRefundable(this.props.status)
        }
        return new Payment({ ...this.props, status: PaymentStatus.REFUNDED })
    }
}

import { BusinessRuleViolationError } from "../errors/business-rule.error.js"

import type { Money } from "../value-objects/money.js"

export interface CashHandoverProps {
    id: string
    businessId: string
    courierId: string
    amount: Money
    at: Date
}

/** Cash a courier gave to the owner. Never more than the courier holds, never zero. */
export class CashHandover {
    private constructor(private readonly props: CashHandoverProps) {}

    static record(input: CashHandoverProps & { onHand: Money }): CashHandover {
        if (input.amount.amount === 0 || input.onHand.isLessThan(input.amount)) {
            throw BusinessRuleViolationError.handoverTooLarge(
                input.onHand.amount,
                input.amount.amount,
            )
        }
        return new CashHandover({
            id: input.id,
            businessId: input.businessId,
            courierId: input.courierId,
            amount: input.amount,
            at: input.at,
        })
    }

    static reconstitute(props: CashHandoverProps): CashHandover {
        return new CashHandover({ ...props })
    }

    get id(): string {
        return this.props.id
    }
    get businessId(): string {
        return this.props.businessId
    }
    get courierId(): string {
        return this.props.courierId
    }
    get amount(): Money {
        return this.props.amount
    }
    get at(): Date {
        return this.props.at
    }
}

import { ValidationError } from "../errors/validation.error.js"

/** Amount of Uzbek sum (UZS). Always a non-negative safe integer. */
export class Money {
    private constructor(public readonly amount: number) {}

    static of(amount: number): Money {
        if (!Number.isSafeInteger(amount) || amount < 0) {
            throw ValidationError.fromField(
                "amount",
                "Must be a non-negative whole number of sum",
                amount,
            )
        }
        return new Money(amount)
    }

    /** An optional limit such as "free delivery from": missing or 0 means "not set". */
    static optional(amount: number | null | undefined): Money | undefined {
        return amount === undefined || amount === null || amount === 0
            ? undefined
            : Money.of(amount)
    }

    static zero(): Money {
        return new Money(0)
    }

    add(other: Money): Money {
        return Money.of(this.amount + other.amount)
    }

    multiply(quantity: number): Money {
        if (!Number.isSafeInteger(quantity) || quantity < 0) {
            throw ValidationError.fromField("quantity", "Must be a non-negative integer", quantity)
        }
        return Money.of(this.amount * quantity)
    }

    isLessThan(other: Money): boolean {
        return this.amount < other.amount
    }

    isAtLeast(other: Money): boolean {
        return this.amount >= other.amount
    }
}

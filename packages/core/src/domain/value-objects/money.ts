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

    isZero(): boolean {
        return this.amount === 0
    }

    isLessThan(other: Money): boolean {
        return this.amount < other.amount
    }

    isAtLeast(other: Money): boolean {
        return this.amount >= other.amount
    }

    equals(other: Money): boolean {
        return this.amount === other.amount
    }
}

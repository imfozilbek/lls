import { ValidationError } from "../errors/validation.error.js"

const BASIS_POINTS = 10_000

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

    /** Never below zero: a balance cannot go negative. */
    subtract(other: Money): Money {
        if (other.amount > this.amount) {
            throw ValidationError.fromField(
                "amount",
                "Cannot take more than there is",
                other.amount,
            )
        }
        return new Money(this.amount - other.amount)
    }

    /** Price per unit × a part of it, e.g. per-kg price × 1500 g / 1000. Rounded to whole sum. */
    multiplyRatio(numerator: number, denominator: number): Money {
        if (!Number.isSafeInteger(numerator) || numerator < 0) {
            throw ValidationError.fromField("quantity", "Must be a non-negative integer", numerator)
        }
        if (!Number.isSafeInteger(denominator) || denominator <= 0) {
            throw ValidationError.fromField(
                "denominator",
                "Must be a positive integer",
                denominator,
            )
        }
        return Money.of(Math.round((this.amount * numerator) / denominator))
    }

    /** Share in basis points (1% = 100 bps), rounded to whole sum. Used for commissions. */
    percent(basisPoints: number): Money {
        return this.multiplyRatio(basisPoints, BASIS_POINTS)
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

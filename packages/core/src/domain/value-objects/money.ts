export class Money {
    private constructor(
        public readonly amount: number,
        public readonly currency: string,
    ) {
        if (amount < 0) {
            throw new Error("Money amount cannot be negative")
        }
    }

    static create(amount: number, currency: string = "UZS"): Money {
        return new Money(amount, currency)
    }

    static zero(currency: string = "UZS"): Money {
        return new Money(0, currency)
    }

    add(other: Money): Money {
        this.ensureSameCurrency(other)
        return new Money(this.amount + other.amount, this.currency)
    }

    subtract(other: Money): Money {
        this.ensureSameCurrency(other)
        return new Money(this.amount - other.amount, this.currency)
    }

    multiply(factor: number): Money {
        return new Money(this.amount * factor, this.currency)
    }

    equals(other: Money): boolean {
        return this.amount === other.amount && this.currency === other.currency
    }

    isZero(): boolean {
        return this.amount === 0
    }

    isGreaterThan(other: Money): boolean {
        this.ensureSameCurrency(other)
        return this.amount > other.amount
    }

    format(): string {
        return `${this.amount.toLocaleString()} ${this.currency}`
    }

    private ensureSameCurrency(other: Money): void {
        if (this.currency !== other.currency) {
            throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`)
        }
    }
}

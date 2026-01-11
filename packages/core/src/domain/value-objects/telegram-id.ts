export class TelegramId {
    private constructor(public readonly value: number) {
        if (!Number.isInteger(value) || value <= 0) {
            throw new Error("Telegram ID must be a positive integer")
        }
    }

    static create(value: number): TelegramId {
        return new TelegramId(value)
    }

    equals(other: TelegramId): boolean {
        return this.value === other.value
    }

    toString(): string {
        return this.value.toString()
    }
}

import { ValidationError } from "../errors/validation.error.js"

export class TelegramId {
    private constructor(public readonly value: number) {}

    static create(value: number): TelegramId {
        if (!Number.isSafeInteger(value) || value <= 0) {
            throw ValidationError.fromField("telegramId", "Must be a positive integer", value)
        }
        return new TelegramId(value)
    }

    equals(other: TelegramId): boolean {
        return this.value === other.value
    }
}

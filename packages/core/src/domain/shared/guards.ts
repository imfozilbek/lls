import { ValidationError } from "../errors/validation.error.js"

export function requireText(field: string, value: string, maxLength: number): string {
    const trimmed = value.trim()
    if (trimmed.length === 0 || trimmed.length > maxLength) {
        throw ValidationError.fromField(field, `Must be 1-${maxLength} characters`, value)
    }
    return trimmed
}

export function optionalText(
    field: string,
    value: string | null | undefined,
    maxLength: number,
): string | undefined {
    if (value === null || value === undefined) {
        return undefined
    }
    const trimmed = value.trim()
    if (trimmed.length === 0) {
        return undefined
    }
    if (trimmed.length > maxLength) {
        throw ValidationError.fromField(field, `Must be at most ${maxLength} characters`, value)
    }
    return trimmed
}

export function requireInteger(field: string, value: number, min: number, max: number): number {
    if (!Number.isSafeInteger(value) || value < min || value > max) {
        throw ValidationError.fromField(field, `Must be an integer from ${min} to ${max}`, value)
    }
    return value
}

export function requireOneOf<T extends string>(
    field: string,
    value: string,
    allowed: readonly T[],
): T {
    const match = allowed.find((item) => item === value)
    if (match === undefined) {
        throw ValidationError.fromField(field, `Must be one of: ${allowed.join(", ")}`, value)
    }
    return match
}

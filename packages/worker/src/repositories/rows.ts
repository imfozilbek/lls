/** Guards for values read back from D1. Corrupt data is a bug, so it throws. */
export function oneOf<T extends string>(value: string, allowed: readonly T[], field: string): T {
    const match = allowed.find((item) => item === value)
    if (match === undefined) {
        throw new Error(`Corrupt ${field} in database: ${value}`)
    }
    return match
}

export function optional<T>(value: T | null): T | undefined {
    return value === null ? undefined : value
}

export function bool(value: number): boolean {
    return value === 1
}

export function flag(value: boolean): number {
    return value ? 1 : 0
}

export function placeholders(count: number): string {
    return Array.from({ length: count }, () => "?").join(", ")
}

export function isUniqueViolation(error: unknown): boolean {
    return error instanceof Error && error.message.includes("UNIQUE constraint failed")
}

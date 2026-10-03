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

/**
 * The `updated_at` each loaded entity had. A save writes only over that very version, so a
 * request working on an older copy gets a conflict instead of undoing someone's change.
 */
export class Versions<T extends object> {
    private readonly loaded = new WeakMap<T, number>()

    remember(entity: T, version: number): T {
        this.loaded.set(entity, version)
        return entity
    }

    /** The version to write, always newer, and the one the row must still have. */
    next(entity: T, wanted: Date): { expected: number | undefined; version: number } {
        const expected = this.loaded.get(entity)
        const version =
            expected === undefined ? wanted.getTime() : Math.max(wanted.getTime(), expected + 1)
        return { expected, version }
    }
}

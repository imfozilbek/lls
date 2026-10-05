/**
 * Counts D1's `rows_read` and `rows_written` (what the free plan bills) under a request: the real
 * database behind statements that report their meta. `first()` is read through `all()`, which
 * carries it.
 */
export interface Rows {
    read: number
    written: number
}

export interface RowsCounter {
    db: D1Database
    /** Rows since the last call. */
    take(): Rows
}

interface Meta {
    meta?: { rows_read?: number; rows_written?: number }
}

export function countingDb(real: D1Database): RowsCounter {
    let rows: Rows = { read: 0, written: 0 }
    const count = <T extends Meta>(result: T): T => {
        rows.read += result.meta?.rows_read ?? 0
        rows.written += result.meta?.rows_written ?? 0
        return result
    }
    const reals = new WeakMap<object, D1PreparedStatement>()

    function wrap(statement: D1PreparedStatement): D1PreparedStatement {
        const wrapped = {
            bind: (...values: unknown[]): D1PreparedStatement => wrap(statement.bind(...values)),
            all: async () => count(await statement.all()),
            run: async () => count(await statement.run()),
            first: async (column?: string): Promise<unknown> => {
                const { results } = count(await statement.all<Record<string, unknown>>())
                const row = results[0]
                if (!row) {
                    return null
                }
                return column === undefined ? row : (row[column] ?? null)
            },
            raw: (options?: { columnNames?: boolean }) =>
                options?.columnNames ? statement.raw({ columnNames: true }) : statement.raw(),
        } as unknown as D1PreparedStatement
        reals.set(wrapped, statement)
        return wrapped
    }

    const db = {
        prepare: (sql: string): D1PreparedStatement => wrap(real.prepare(sql)),
        batch: async (statements: D1PreparedStatement[]) => {
            const results = await real.batch(statements.map((s) => reals.get(s) ?? s))
            results.forEach(count)
            return results
        },
        exec: (sql: string) => real.exec(sql),
        dump: () => real.dump(),
        withSession: (constraint?: string) => real.withSession(constraint),
    } as unknown as D1Database

    return {
        db,
        take(): Rows {
            const taken = rows
            rows = { read: 0, written: 0 }
            return taken
        },
    }
}

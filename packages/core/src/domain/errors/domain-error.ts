export abstract class DomainError extends Error {
    abstract readonly code: string

    constructor(
        message: string,
        public readonly details?: Record<string, unknown>,
    ) {
        super(message)
        this.name = this.constructor.name
        Error.captureStackTrace(this, this.constructor)
    }

    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            details: this.details,
        }
    }
}

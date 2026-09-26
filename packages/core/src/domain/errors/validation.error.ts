import { DomainError } from "./domain-error.js"

export interface ValidationErrorDetail {
    field: string
    message: string
    value?: unknown
}

export class ValidationError extends DomainError {
    readonly code = "VALIDATION_ERROR"

    constructor(
        message: string,
        public readonly errors: ValidationErrorDetail[] = [],
    ) {
        super(message, { errors })
    }

    static fromField(field: string, message: string, value?: unknown): ValidationError {
        return new ValidationError(`Validation failed for field: ${field}`, [
            { field, message, value },
        ])
    }
}

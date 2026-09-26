import { BusinessRuleViolationError, DomainError } from "@lls/core"
import { HTTPException } from "hono/http-exception"

import type { ContentfulStatusCode } from "hono/utils/http-status"

export interface ErrorBody {
    error: { code: string; message: string; details?: unknown }
}

const STATUS_BY_CODE: Record<string, ContentfulStatusCode> = {
    VALIDATION_ERROR: 400,
    FORBIDDEN: 403,
    ENTITY_NOT_FOUND: 404,
    CONFLICT: 409,
    INVALID_ORDER_TRANSITION: 409,
    BUSINESS_RULE_VIOLATION: 422,
}

export class ApiError extends HTTPException {
    constructor(
        status: ContentfulStatusCode,
        public readonly code: string,
        message: string,
    ) {
        super(status, { message })
    }
}

export function unauthorized(): ApiError {
    return new ApiError(401, "UNAUTHORIZED", "Open the app from Telegram")
}

/** Maps any thrown value to an HTTP status and the standard error body. */
export function toErrorResponse(error: unknown): { status: ContentfulStatusCode; body: ErrorBody } {
    if (error instanceof DomainError) {
        // Business rules use their rule id as the code, so the app can show a translated message.
        const code = error instanceof BusinessRuleViolationError ? error.rule : error.code
        return {
            status: STATUS_BY_CODE[error.code] ?? 400,
            body: { error: { code, message: error.message, details: error.details } },
        }
    }
    if (error instanceof ApiError) {
        return {
            status: error.status as ContentfulStatusCode,
            body: { error: { code: error.code, message: error.message } },
        }
    }
    if (error instanceof HTTPException) {
        return {
            status: error.status as ContentfulStatusCode,
            body: { error: { code: "HTTP_ERROR", message: error.message } },
        }
    }
    return {
        status: 500,
        body: { error: { code: "INTERNAL", message: "Something went wrong" } },
    }
}

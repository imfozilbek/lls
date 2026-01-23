import { Injectable, PipeTransform, BadRequestException } from "@nestjs/common"

import type { ArgumentMetadata } from "@nestjs/common"

/**
 * Sanitize string input by removing dangerous characters and patterns
 */
export function sanitizeString(value: string): string {
    if (typeof value !== "string") {
        return value
    }

    return (
        value
            // Remove null bytes
            .replace(/\0/g, "")
            // Remove script tags
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            // Remove on* event handlers
            .replace(/\bon\w+\s*=/gi, "")
            // Remove javascript: protocol
            .replace(/javascript:/gi, "")
            // Trim whitespace
            .trim()
    )
}

/**
 * Recursively sanitize object values
 */
export function sanitizeObject<T>(obj: T): T {
    if (obj === null || obj === undefined) {
        return obj
    }

    if (typeof obj === "string") {
        return sanitizeString(obj) as T
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeObject(item)) as T
    }

    if (typeof obj === "object") {
        const sanitized: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(obj)) {
            sanitized[sanitizeString(key)] = sanitizeObject(value)
        }
        return sanitized as T
    }

    return obj
}

/**
 * Validation pipe that sanitizes input data
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
    transform(value: unknown, _metadata: ArgumentMetadata): unknown {
        return sanitizeObject(value)
    }
}

/**
 * Check for SQL injection patterns
 */
export function hasSqlInjection(value: string): boolean {
    const sqlPatterns = [
        /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
        /(--)|(;)|(\/\*)|(\*\/)/,
        /(\bor\b|\band\b)\s+[\d\w]+\s*=\s*[\d\w]+/i,
    ]

    return sqlPatterns.some((pattern) => pattern.test(value))
}

/**
 * Check for NoSQL injection patterns
 */
export function hasNoSqlInjection(value: string): boolean {
    const nosqlPatterns = [/\$where/i, /\$gt|\$lt|\$ne|\$eq|\$regex/i, /\{\s*\$\w+/]

    return nosqlPatterns.some((pattern) => pattern.test(value))
}

/**
 * Validate and sanitize input, throw if dangerous patterns detected
 */
export function validateInput(value: string, fieldName: string): string {
    if (hasSqlInjection(value)) {
        throw new BadRequestException(`Invalid characters in ${fieldName}`)
    }

    if (hasNoSqlInjection(value)) {
        throw new BadRequestException(`Invalid characters in ${fieldName}`)
    }

    return sanitizeString(value)
}

/**
 * Escape HTML entities
 */
export function escapeHtml(value: string): string {
    const htmlEntities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }

    return value.replace(/[&<>"']/g, (char) => htmlEntities[char] ?? char)
}

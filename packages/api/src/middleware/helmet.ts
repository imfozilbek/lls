import type { FastifyInstance } from "fastify"

/**
 * Security headers configuration using fastify-helmet
 */
export const helmetConfig = {
    // Content Security Policy
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    // Cross-Origin settings
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" as const },
    crossOriginResourcePolicy: { policy: "same-origin" as const },
    // DNS Prefetch Control
    dnsPrefetchControl: { allow: false },
    // Frameguard (prevent clickjacking)
    frameguard: { action: "deny" as const },
    // Hide X-Powered-By header
    hidePoweredBy: true,
    // HSTS (HTTP Strict Transport Security)
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
    },
    // IE No Open
    ieNoOpen: true,
    // No Sniff (prevent MIME type sniffing)
    noSniff: true,
    // Referrer Policy
    referrerPolicy: { policy: "strict-origin-when-cross-origin" as const },
    // XSS Filter
    xssFilter: true,
}

/**
 * Register helmet plugin with Fastify
 */
export async function registerHelmet(app: FastifyInstance): Promise<void> {
    const helmet = await import("@fastify/helmet")
    await app.register(helmet.default, helmetConfig)
}

/**
 * Security headers for API responses
 */
export const securityHeaders = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
}

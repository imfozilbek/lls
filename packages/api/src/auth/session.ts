import { Injectable } from "@nestjs/common"

import { CacheService } from "../cache/cache.service.js"

export interface SessionData {
    telegramId: number
    businessId?: string
    role: "customer" | "courier" | "business"
    createdAt: number
    lastActivity: number
}

const SESSION_PREFIX = "session:"
const SESSION_TTL = 3600 // 1 hour in seconds

/**
 * Session management service using Redis
 */
@Injectable()
export class SessionService {
    constructor(private readonly cacheService: CacheService) {}

    /**
     * Create a new session
     */
    async createSession(
        sessionId: string,
        data: Omit<SessionData, "createdAt" | "lastActivity">,
    ): Promise<void> {
        const now = Date.now()
        const session: SessionData = {
            ...data,
            createdAt: now,
            lastActivity: now,
        }
        await this.cacheService.setex(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL, session)
    }

    /**
     * Get session data
     */
    async getSession(sessionId: string): Promise<SessionData | null> {
        return this.cacheService.get<SessionData>(`${SESSION_PREFIX}${sessionId}`)
    }

    /**
     * Update session last activity
     */
    async touchSession(sessionId: string): Promise<boolean> {
        const session = await this.getSession(sessionId)
        if (!session) {
            return false
        }

        session.lastActivity = Date.now()
        await this.cacheService.setex(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL, session)
        return true
    }

    /**
     * Delete session
     */
    async deleteSession(sessionId: string): Promise<void> {
        await this.cacheService.del(`${SESSION_PREFIX}${sessionId}`)
    }

    /**
     * Check if session is valid
     */
    async isValidSession(sessionId: string): Promise<boolean> {
        const session = await this.getSession(sessionId)
        if (!session) {
            return false
        }

        // Check if session has expired due to inactivity
        const inactivityTimeout = SESSION_TTL * 1000
        if (Date.now() - session.lastActivity > inactivityTimeout) {
            await this.deleteSession(sessionId)
            return false
        }

        return true
    }

    /**
     * Generate a unique session ID
     */
    generateSessionId(): string {
        const timestamp = Date.now().toString(36)
        const random = Math.random().toString(36).substring(2, 15)
        return `${timestamp}-${random}`
    }
}

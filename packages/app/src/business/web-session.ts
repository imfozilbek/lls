import type { WebSession } from "../lib/api.js"

/** Where a computer keeps its Zumda | Business sign-in. */
const KEY = "zumda.business.session"

/** The saved session, if any and not expired. Storage may be off (private mode): then none. */
export function loadSession(now = Date.now()): WebSession | null {
    try {
        const raw = window.localStorage.getItem(KEY)
        const session = raw ? (JSON.parse(raw) as WebSession) : null
        return session && new Date(session.expiresAt).getTime() > now ? session : null
    } catch {
        return null
    }
}

export function saveSession(session: WebSession): void {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(session))
    } catch {
        // Without storage the sign-in lasts until the tab closes.
    }
}

export function clearSession(): void {
    try {
        window.localStorage.removeItem(KEY)
    } catch {
        // Nothing saved, nothing to clear.
    }
}

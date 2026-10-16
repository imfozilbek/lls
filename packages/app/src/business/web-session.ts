import type { WebBot, WebSession } from "../lib/api.js"

/**
 * Where a computer keeps a sign-in: one per bot, so Zumda | Business and «Platforma» never share
 * one (on the stand they are the same address).
 */
const KEY: Record<WebBot, string> = {
    business: "zumda.business.session",
    admin: "zumda.platform.session",
}

/** The saved session, if any and not expired. Storage may be off (private mode): then none. */
export function loadSession(bot: WebBot = "business", now = Date.now()): WebSession | null {
    try {
        const raw = window.localStorage.getItem(KEY[bot])
        const session = raw ? (JSON.parse(raw) as WebSession) : null
        return session && new Date(session.expiresAt).getTime() > now ? session : null
    } catch {
        return null
    }
}

export function saveSession(session: WebSession, bot: WebBot = "business"): void {
    try {
        window.localStorage.setItem(KEY[bot], JSON.stringify(session))
    } catch {
        // Without storage the sign-in lasts until the tab closes.
    }
}

export function clearSession(bot: WebBot = "business"): void {
    try {
        window.localStorage.removeItem(KEY[bot])
    } catch {
        // Nothing saved, nothing to clear.
    }
}

import { API_URL } from "./api.js"
import { crashFacts } from "./crash-facts.js"

import type { CrashFacts, CrashKind } from "@zumda/core"

/**
 * Mini App crashes reach the server log and the admins (`POST /api/client-errors`). The same
 * shape as `@samiyev/kit/observe` `listenForCrashes`, so this file can later be that import.
 */

/** Even a crash loop costs the free plan at most this many requests a session. */
const MAX_REPORTS = 5

/** Sends the facts once, even while the page closes; never fails. */
export function sendCrash(facts: CrashFacts): void {
    // text/plain is a "simple" request: no CORS preflight, one Worker request per crash. No
    // initData, no identity: the facts carry nothing about the person.
    fetch(`${API_URL}/api/client-errors`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(facts),
    }).catch(() => undefined)
}

/**
 * Listens to uncaught errors and unhandled promise rejections; each kind of crash goes once a
 * session. Errors of other sites' scripts (Telegram's own) are not ours and stay out.
 */
export function listenForCrashes(
    screen: () => string,
    send: (facts: CrashFacts) => void = sendCrash,
    target: EventTarget = window,
    origin: string = window.location.origin,
): () => void {
    const seen = new Set<string>()
    const report = (reason: unknown, kind: CrashKind): void => {
        const facts = crashFacts(reason, kind, screen(), origin)
        const key = `${facts.kind} ${facts.name} ${facts.where || facts.detail}`
        if (seen.has(key) || seen.size >= MAX_REPORTS) {
            return
        }
        seen.add(key)
        try {
            send(facts)
        } catch {
            // A report must never become a crash of its own.
        }
    }
    const onError = (event: Event): void => {
        const { error, message, filename } = event as ErrorEvent
        // "Script error." is a script of another site the browser hides from us.
        if ((filename && !filename.startsWith(origin)) || (!error && message === "Script error.")) {
            return
        }
        report(error ?? message, "error")
    }
    const onRejection = (event: Event): void => {
        report((event as PromiseRejectionEvent).reason, "rejection")
    }
    target.addEventListener("error", onError)
    target.addEventListener("unhandledrejection", onRejection)
    return (): void => {
        target.removeEventListener("error", onError)
        target.removeEventListener("unhandledrejection", onRejection)
    }
}

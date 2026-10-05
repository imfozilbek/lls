import { CRASH_LIMITS, CRASH_SCREEN, CRASH_WHERE, safeCrashText } from "@zumda/core"

import type { CrashFacts, CrashKind } from "@zumda/core"

/**
 * A crash told safely: the error's class, its message without digits or other alphabets, the
 * place in our own bundle and the screen. The same shape as `@samiyev/kit/observe` `crashFacts`,
 * so this file can later be that import.
 */

/** `https://app.zumda.shop/assets/index-Bz.js?v=1:12:34` → `index-Bz.js:12:34`. */
const FRAME = /\/([\w.-]+\.(?:m?js|jsx|tsx?))(?:\?[^\s:)]*)?:(\d+):(\d+)/
const NOT_LETTERS = /[^A-Za-z]+/g

/** The first line of the stack that is ours (served from `origin`), as `file:line:column`. */
export function ownPlace(stack: string | undefined, origin: string): string {
    for (const line of (stack ?? "").split("\n")) {
        if (!line.includes(origin)) {
            continue
        }
        const match = FRAME.exec(line)
        const place = match ? `${match[1]}:${match[2]}:${match[3]}` : ""
        if (CRASH_WHERE.test(place) && place.length <= CRASH_LIMITS.where) {
            return place
        }
    }
    return ""
}

/** `shop:checkout`; anything else becomes `unknown`. */
export function safeScreen(screen: string): string {
    return CRASH_SCREEN.test(screen) && screen.length <= CRASH_LIMITS.screen ? screen : "unknown"
}

export function crashFacts(
    reason: unknown,
    kind: CrashKind,
    screen: string,
    origin: string,
): CrashFacts {
    const error = reason instanceof Error ? reason : null
    const name = (error?.name ?? "NonError").replace(NOT_LETTERS, "").slice(0, CRASH_LIMITS.name)
    const message = error ? error.message : typeof reason === "string" ? reason : ""
    return {
        kind,
        name: name || "Error",
        detail: safeCrashText(message),
        where: ownPlace(error?.stack, origin),
        screen: safeScreen(screen),
    }
}

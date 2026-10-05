/**
 * What a Mini App crash may tell the server: never a phone, an id, a name or a token. The app
 * cleans it before sending and the Worker cleans it again (it never trusts the client). The same
 * rules as `@samiyev/kit/observe` (`crashFacts`), so this module can later be that import.
 */
export const CRASH_KINDS = ["error", "rejection"] as const
export type CrashKind = (typeof CRASH_KINDS)[number]

export interface CrashFacts {
    kind: CrashKind
    /** The error's class, e.g. `TypeError`. */
    name: string
    /** The message without digits or letters of other alphabets. */
    detail: string
    /** `file.js:line:column` in our own bundle, or empty. */
    where: string
    /** The app's mode and screen, e.g. `shop:checkout`. */
    screen: string
}

export const CRASH_LIMITS = { name: 40, detail: 160, where: 80, screen: 40 } as const

/** `file.js:12:34`: a file of our bundle (`.tsx` under the dev server) and a position in it. */
export const CRASH_WHERE = /^[\w.-]+\.(?:m?js|jsx|tsx?):\d{1,7}:\d{1,7}$/
export const CRASH_NAME = /^[A-Za-z]+$/
export const CRASH_SCREEN = /^[a-z_:-]+$/

/** Long runs of letters and digits mixed: tokens, ids, hashes. Gone whole, not only digits. */
const SECRET_LIKE = /[\w:-]*\d[\w:-]*/g
const NOT_SAFE = /[^A-Za-z .,:'()_-]+/g
const SPACES = /\s+/g

/** A crash message safe to log: no digits, no other alphabets, no token-like runs. */
export function safeCrashText(text: string, max: number = CRASH_LIMITS.detail): string {
    return text
        .replace(SECRET_LIKE, " ")
        .replace(NOT_SAFE, " ")
        .replace(SPACES, " ")
        .trim()
        .slice(0, max)
}

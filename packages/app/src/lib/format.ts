import type { Language } from "@lls/core"

const CURRENCY: Record<Language, string> = { uz: "so'm", ru: "сум" }

export function currencyOf(language: Language): string {
    return CURRENCY[language]
}

/** 78000 → "78 000 so'm". Narrow no-break spaces keep the price on one line. */
export function formatMoney(amount: number, language: Language): string {
    const grouped = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f")
    return `${grouped}\u00a0${CURRENCY[language]}`
}

/** Russian needs 3 plural forms; Uzbek uses one form after numbers. */
export function plural(n: number, forms: readonly [string, string, string]): string {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) {
        return forms[0]
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        return forms[1]
    }
    return forms[2]
}

const MONTHS: Record<Language, readonly string[]> = {
    uz: ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"],
    ru: ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
}

const UZ_OFFSET_MS = 5 * 60 * 60 * 1000

/** "14:05" or "12 okt, 14:05" in Tashkent time, independent of the phone's timezone. */
export function formatTime(iso: string, language: Language, now: Date = new Date()): string {
    const local = new Date(new Date(iso).getTime() + UZ_OFFSET_MS)
    const today = new Date(now.getTime() + UZ_OFFSET_MS)
    const time = `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`
    const sameDay =
        local.getUTCFullYear() === today.getUTCFullYear() &&
        local.getUTCMonth() === today.getUTCMonth() &&
        local.getUTCDate() === today.getUTCDate()
    if (sameDay) {
        return time
    }
    return `${local.getUTCDate()} ${MONTHS[language][local.getUTCMonth()]}, ${time}`
}

/** "#0ea5e9" → "14 165 233" for `rgb(var(--brand-rgb) / a)`. */
export function hexToRgbChannels(hex: string): string | null {
    const match = /^#([0-9a-f]{6})$/i.exec(hex)
    if (!match?.[1]) {
        return null
    }
    const value = Number.parseInt(match[1], 16)
    return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`
}

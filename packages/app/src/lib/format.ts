import type { Language } from "@zumda/core"

const CURRENCY: Record<Language, string> = { uz: "so'm" }

export function currencyOf(language: Language): string {
    return CURRENCY[language]
}

/** 78000 → "78 000 so'm". Narrow no-break spaces keep the price on one line. */
export function formatMoney(amount: number, language: Language): string {
    const grouped = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f")
    return `${grouped}\u00a0${CURRENCY[language]}`
}

const MONTHS: Record<Language, readonly string[]> = {
    uz: ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"],
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

const GRAMS_PER_KG = 1000
/** Counted as they are: "2" pieces, portions, litres or bottles need no word in a stepper. */
const COUNTED = new Set(["pcs", "portion", "l", "bottle_19l", "bottle_20l"])
const WEIGHT = new Set(["kg", "g100", "g"])

/**
 * A quantity as people say it: "2" for pieces, "1,5 kg" for kilograms (quantity in grams), "300 g"
 * for goods priced per 100 g or per gram (from 1 kg on, in kilograms), "12 m²" for the rest.
 * `units` is the dictionary's unit words (`t.units`).
 */
export function formatQuantity(
    quantity: number,
    unit: string,
    units: Record<string, string>,
): string {
    if (WEIGHT.has(unit)) {
        if (unit === "kg" || quantity >= GRAMS_PER_KG) {
            return `${String(quantity / GRAMS_PER_KG).replace(".", ",")} ${units["kg"] ?? "kg"}`
        }
        return `${quantity} ${units["g"] ?? "g"}`
    }
    if (COUNTED.has(unit)) {
        return String(quantity)
    }
    const word = units[unit]
    return word ? `${quantity} ${word}` : String(quantity)
}

const METERS_PER_KM = 1000

/** 3000 → "3", 2500 → "2,5": the radius as people say it. */
export function kmText(meters: number): string {
    const km = Math.round((meters / METERS_PER_KM) * 10) / 10
    return String(km).replace(".", ",")
}

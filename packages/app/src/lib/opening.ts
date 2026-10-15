import { nextOpening } from "@zumda/core"

import { fill } from "../i18n/index.js"

import type { Dictionary } from "../i18n/index.js"
import type { WeeklySchedule } from "@zumda/core"

/** "09:00" reads «9:00». */
function clock(time: string): string {
    return time.replace(/^0(\d)/, "$1")
}

/**
 * When a closed shop opens next, in words: «ertaga soat 9:00 da». `null` for a shop without hours
 * or a week without a working day.
 */
export function opensWhen(
    t: Dictionary,
    hours: WeeklySchedule | null,
    now: Date = new Date(),
): string | null {
    const next = hours ? nextOpening(hours, now) : null
    if (!next) {
        return null
    }
    const time = clock(next.time)
    if (next.inDays === 0) {
        return fill(t.shop.opensToday, { time })
    }
    if (next.inDays === 1) {
        return fill(t.shop.opensTomorrow, { time })
    }
    return fill(t.shop.opensOn, { day: t.shop.weekdays[next.weekday], time })
}

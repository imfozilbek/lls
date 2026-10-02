import { WEEKDAYS } from "@lls/core"

import type { WeeklySchedule } from "@lls/core"

export interface DayHours {
    open: boolean
    from: string
    to: string
}

export interface Hours {
    alwaysOpen: boolean
    /** Index 0 = Monday, as in WEEKDAYS. A closed day keeps its times for when it opens again. */
    days: DayHours[]
}

export const DEFAULT_OPEN = "09:00"
export const DEFAULT_CLOSE = "22:00"

/** Each day its own hours: a shop may close on Monday and work late on Friday. */
export function hoursOf(schedule: WeeklySchedule | null): Hours {
    return {
        alwaysOpen: schedule === null,
        days: WEEKDAYS.map((day) => {
            const range = schedule?.[day]
            return {
                open: schedule === null || range !== undefined,
                from: range?.open ?? DEFAULT_OPEN,
                to: range?.close ?? DEFAULT_CLOSE,
            }
        }),
    }
}

export function scheduleOf(hours: Hours): WeeklySchedule | null {
    if (hours.alwaysOpen) {
        return null
    }
    const schedule: WeeklySchedule = {}
    WEEKDAYS.forEach((day, index) => {
        const today = hours.days[index]
        if (today?.open) {
            schedule[day] = { open: today.from, close: today.to }
        }
    })
    return schedule
}

/** "Как в понедельник для всех дней": Monday's switch and times copied to every day. */
export function sameAsMonday(hours: Hours): Hours {
    const monday = hours.days[0]
    return monday ? { ...hours, days: hours.days.map(() => ({ ...monday })) } : hours
}

/** At least one working day, unless the shop is open around the clock. */
export function hasOpenDay(hours: Hours): boolean {
    return hours.alwaysOpen || hours.days.some((day) => day.open)
}

/** Uzbekistan is UTC+5 all year (no DST). */
export const UZ_UTC_OFFSET_MINUTES = 300

const MINUTES_PER_DAY = 24 * 60
const MS_PER_MINUTE = 60_000
const DAYS_PER_WEEK = 7

export interface LocalTime {
    /** 0 = Monday … 6 = Sunday */
    weekday: number
    /** Minutes since local midnight */
    minutes: number
}

export function toLocalTime(date: Date, offsetMinutes: number = UZ_UTC_OFFSET_MINUTES): LocalTime {
    const local = new Date(date.getTime() + offsetMinutes * MS_PER_MINUTE)
    const sundayFirst = local.getUTCDay()
    return {
        weekday: (sundayFirst + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK,
        minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
    }
}

/** Start of the local day (UZ time) that contains `date`, as a UTC instant. */
export function startOfLocalDay(date: Date, offsetMinutes: number = UZ_UTC_OFFSET_MINUTES): Date {
    const { minutes } = toLocalTime(date, offsetMinutes)
    const withoutSeconds = date.getTime() - (date.getTime() % MS_PER_MINUTE)
    return new Date(withoutSeconds - minutes * MS_PER_MINUTE)
}

export function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * MINUTES_PER_DAY * MS_PER_MINUTE)
}

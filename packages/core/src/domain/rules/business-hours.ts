export interface TimeRange {
    open: string // HH:mm format
    close: string // HH:mm format
}

export interface BusinessHours {
    monday?: TimeRange
    tuesday?: TimeRange
    wednesday?: TimeRange
    thursday?: TimeRange
    friday?: TimeRange
    saturday?: TimeRange
    sunday?: TimeRange
}

type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"

const DAYS_OF_WEEK: DayOfWeek[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
]

/**
 * Parse time string (HH:mm) to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number)
    return (hours ?? 0) * 60 + (minutes ?? 0)
}

/**
 * Get current day of week
 */
function getCurrentDay(date: Date = new Date()): DayOfWeek {
    return DAYS_OF_WEEK[date.getDay()] as DayOfWeek
}

/**
 * Get current time in minutes since midnight
 */
function getCurrentTimeMinutes(date: Date = new Date()): number {
    return date.getHours() * 60 + date.getMinutes()
}

/**
 * Check if business is currently open
 */
export function isBusinessOpen(hours: BusinessHours, date: Date = new Date()): boolean {
    const day = getCurrentDay(date)
    const todayHours = hours[day]

    if (!todayHours) {
        return false
    }

    const currentMinutes = getCurrentTimeMinutes(date)
    const openMinutes = parseTimeToMinutes(todayHours.open)
    const closeMinutes = parseTimeToMinutes(todayHours.close)

    // Handle overnight hours (e.g., 22:00 - 02:00)
    if (closeMinutes < openMinutes) {
        return currentMinutes >= openMinutes || currentMinutes < closeMinutes
    }

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
}

/**
 * Get today's business hours
 */
export function getTodayHours(hours: BusinessHours, date: Date = new Date()): TimeRange | null {
    const day = getCurrentDay(date)
    return hours[day] ?? null
}

/**
 * Get next opening time
 */
export function getNextOpeningTime(hours: BusinessHours, date: Date = new Date()): Date | null {
    const startDay = date.getDay()

    for (let i = 0; i < 7; i++) {
        const dayIndex = (startDay + i) % 7
        const day = DAYS_OF_WEEK[dayIndex] as DayOfWeek
        const dayHours = hours[day]

        if (dayHours) {
            const [openHours, openMinutes] = dayHours.open.split(":").map(Number)
            const nextOpen = new Date(date)
            nextOpen.setDate(date.getDate() + i)
            nextOpen.setHours(openHours ?? 0, openMinutes ?? 0, 0, 0)

            // If it's today but the opening time has passed, continue to next day
            if (i === 0 && nextOpen <= date) {
                continue
            }

            return nextOpen
        }
    }

    return null
}

/**
 * Validate business hours format
 */
export function validateBusinessHours(hours: BusinessHours): string[] {
    const errors: string[] = []
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/

    for (const day of DAYS_OF_WEEK) {
        const dayHours = hours[day]
        if (dayHours) {
            if (!timeRegex.test(dayHours.open)) {
                errors.push(`Invalid open time format for ${day}: ${dayHours.open}`)
            }
            if (!timeRegex.test(dayHours.close)) {
                errors.push(`Invalid close time format for ${day}: ${dayHours.close}`)
            }
        }
    }

    return errors
}

/**
 * Create default business hours (9:00-18:00, Mon-Fri)
 */
export function createDefaultBusinessHours(): BusinessHours {
    const defaultTime: TimeRange = { open: "09:00", close: "18:00" }
    return {
        monday: defaultTime,
        tuesday: defaultTime,
        wednesday: defaultTime,
        thursday: defaultTime,
        friday: defaultTime,
    }
}

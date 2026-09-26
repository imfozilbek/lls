import { ValidationError } from "../errors/validation.error.js"
import { UZ_UTC_OFFSET_MINUTES, toLocalTime } from "../shared/time.js"

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

/** Index = LocalTime.weekday (0 = Monday). */
export const WEEKDAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

/** "HH:mm". `close < open` means the shop works past midnight. `open === close` means 24 hours. */
export interface TimeRange {
    open: string
    close: string
}

/** A missing day means the shop is closed that day. */
export type WeeklySchedule = Partial<Record<Weekday, TimeRange>>

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

function toMinutes(time: string): number {
    const match = TIME_PATTERN.exec(time)
    if (!match) {
        throw ValidationError.fromField("workingHours", "Time must be HH:mm", time)
    }
    return Number(match[1]) * 60 + Number(match[2])
}

export class WorkingHours {
    private constructor(private readonly schedule: WeeklySchedule | null) {}

    static alwaysOpen(): WorkingHours {
        return new WorkingHours(null)
    }

    static create(schedule: WeeklySchedule): WorkingHours {
        const clean: WeeklySchedule = {}
        for (const day of WEEKDAYS) {
            const range = schedule[day]
            if (range) {
                toMinutes(range.open)
                toMinutes(range.close)
                clean[day] = { open: range.open, close: range.close }
            }
        }
        return new WorkingHours(clean)
    }

    /** `null` (from storage) means always open. */
    static fromJSON(value: WeeklySchedule | null): WorkingHours {
        return value === null ? WorkingHours.alwaysOpen() : WorkingHours.create(value)
    }

    isOpenAt(date: Date, offsetMinutes: number = UZ_UTC_OFFSET_MINUTES): boolean {
        if (this.schedule === null) {
            return true
        }
        const { weekday, minutes } = toLocalTime(date, offsetMinutes)
        const today = this.schedule[WEEKDAYS[weekday] as Weekday]
        if (today && this.coversToday(today, minutes)) {
            return true
        }
        const yesterday = this.schedule[WEEKDAYS[(weekday + 6) % 7] as Weekday]
        return yesterday !== undefined && this.coversAfterMidnight(yesterday, minutes)
    }

    toJSON(): WeeklySchedule | null {
        return this.schedule === null ? null : { ...this.schedule }
    }

    private coversToday(range: TimeRange, minutes: number): boolean {
        const open = toMinutes(range.open)
        const close = toMinutes(range.close)
        if (open === close) {
            return true
        }
        if (open < close) {
            return minutes >= open && minutes < close
        }
        return minutes >= open
    }

    private coversAfterMidnight(range: TimeRange, minutes: number): boolean {
        const open = toMinutes(range.open)
        const close = toMinutes(range.close)
        return close < open && minutes < close
    }
}

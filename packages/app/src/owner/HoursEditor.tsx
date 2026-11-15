import { useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"
import { Switch } from "../ui/primitives.js"

import { sameAsMonday, timeChoices } from "./hours.js"

import type { DayHours, Hours } from "./hours.js"

const TIME_INPUT =
    "field h-11 w-full min-w-0 appearance-none rounded-[0.625rem] bg-tg-bg px-1 text-center tabular-nums"

/**
 * A time as people here say it: 24 hours, «09:00». The browser's own time field shows
 * «12:00 AM» on many Android phones (it reads the page's language, and has no Uzbek), and was
 * wider than the screen.
 */
function TimeSelect({
    value,
    label,
    onChange,
}: {
    value: string
    label: string
    onChange(value: string): void
}): React.JSX.Element {
    return (
        <select
            aria-label={label}
            value={value}
            onChange={(e): void => onChange(e.target.value)}
            className={TIME_INPUT}
        >
            {timeChoices(value).map((time) => (
                <option key={time} value={time}>
                    {time}
                </option>
            ))}
        </select>
    )
}

function DayRow({
    label,
    day,
    onChange,
}: {
    label: string
    day: DayHours
    onChange(day: DayHours): void
}): React.JSX.Element {
    const s = useT().owner.settings
    return (
        <div className="grid min-h-[52px] grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 py-1.5">
            <span className={cn("font-semibold", day.open ? "text-tg-text" : "text-tg-hint")}>
                {label}
            </span>
            {day.open ? (
                <div className="flex min-w-0 animate-fade-in items-center gap-1.5">
                    <TimeSelect
                        label={`${label} · ${s.opens}`}
                        value={day.from}
                        onChange={(from): void => onChange({ ...day, from })}
                    />
                    <span className="text-tg-hint">-</span>
                    <TimeSelect
                        label={`${label} · ${s.closes}`}
                        value={day.to}
                        onChange={(to): void => onChange({ ...day, to })}
                    />
                </div>
            ) : (
                <span className="animate-fade-in text-sm text-tg-hint">{s.closed}</span>
            )}
            <Switch
                checked={day.open}
                onChange={(open): void => onChange({ ...day, open })}
                label={label}
            />
        </div>
    )
}

/** Around the clock, or each day with its own hours (or a day off). */
export function HoursEditor({
    hours,
    onChange,
}: {
    hours: Hours
    onChange(hours: Hours): void
}): React.JSX.Element {
    const s = useT().owner.settings
    return (
        <div className="flex flex-col gap-2 rounded-tile bg-tg-secondary p-4">
            <label className="flex items-center justify-between gap-3">
                <span className="font-medium">{s.alwaysOpen}</span>
                <Switch
                    checked={hours.alwaysOpen}
                    onChange={(alwaysOpen): void => onChange({ ...hours, alwaysOpen })}
                    label={s.alwaysOpen}
                />
            </label>
            {hours.alwaysOpen ? null : (
                <>
                    <div className="mt-2 flex flex-col divide-y divide-tg-separator">
                        {s.days.map((label, index) => {
                            const day = hours.days[index]
                            return day ? (
                                <DayRow
                                    key={label}
                                    label={label}
                                    day={day}
                                    onChange={(next): void =>
                                        onChange({
                                            ...hours,
                                            days: hours.days.map((d, i) =>
                                                i === index ? next : d,
                                            ),
                                        })
                                    }
                                />
                            ) : null
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={(): void => {
                            haptic.select()
                            onChange(sameAsMonday(hours))
                        }}
                        className="tap mt-1 h-11 rounded-control text-sm font-semibold text-brand"
                    >
                        {s.sameAsMonday}
                    </button>
                </>
            )}
        </div>
    )
}

import { useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"
import { Switch } from "../ui/primitives.js"

import { sameAsMonday } from "./hours.js"

import type { DayHours, Hours } from "./hours.js"

const TIME_INPUT =
    "field h-10 w-full min-w-0 rounded-[0.625rem] bg-tg-bg px-2 text-center tabular-nums"

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
        <div className="grid min-h-[52px] grid-cols-[2.25rem_1fr_auto] items-center gap-2 py-1.5">
            <span className={cn("font-semibold", day.open ? "text-tg-text" : "text-tg-hint")}>
                {label}
            </span>
            {day.open ? (
                <div className="flex animate-fade-in items-center gap-1.5">
                    <input
                        type="time"
                        aria-label={`${label} · ${s.opens}`}
                        value={day.from}
                        onChange={(e): void => onChange({ ...day, from: e.target.value })}
                        className={TIME_INPUT}
                    />
                    <span className="text-tg-hint">–</span>
                    <input
                        type="time"
                        aria-label={`${label} · ${s.closes}`}
                        value={day.to}
                        onChange={(e): void => onChange({ ...day, to: e.target.value })}
                        className={TIME_INPUT}
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
                        className="tap mt-1 h-10 rounded-control text-sm font-semibold text-brand"
                    >
                        {s.sameAsMonday}
                    </button>
                </>
            )}
        </div>
    )
}

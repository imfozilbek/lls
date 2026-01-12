import { cn } from "../../lib/utils.js"

import type { AnalyticsPeriod } from "@lls/core"
import type { ReactNode } from "react"

interface PeriodSelectorProps {
    value: AnalyticsPeriod
    onChange: (period: AnalyticsPeriod) => void
    className?: string
}

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
    { value: "day", label: "Сегодня" },
    { value: "week", label: "Неделя" },
    { value: "month", label: "Месяц" },
]

export function PeriodSelector({
    value,
    onChange,
    className = "",
}: PeriodSelectorProps): ReactNode {
    return (
        <div className={cn("inline-flex rounded-lg bg-gray-100 p-1", className)}>
            {PERIODS.map((period) => (
                <button
                    key={period.value}
                    onClick={(): void => onChange(period.value)}
                    className={cn(
                        "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                        value === period.value
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-600 hover:text-gray-900",
                    )}
                >
                    {period.label}
                </button>
            ))}
        </div>
    )
}

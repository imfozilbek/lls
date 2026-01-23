import { type ReactNode } from "react"

import { cn } from "../../lib/utils.js"

import { BusinessType } from "@lls/core"

interface FilterOption {
    value: BusinessType | "all"
    label: string
    emoji: string
}

const filterOptions: FilterOption[] = [
    { value: "all", label: "Все", emoji: "🏪" },
    { value: BusinessType.FOOD, label: "Еда", emoji: "🍔" },
    { value: BusinessType.WATER, label: "Вода", emoji: "💧" },
    { value: BusinessType.CONSTRUCTION, label: "Стройка", emoji: "🔨" },
]

interface BusinessTypeFilterProps {
    selected: BusinessType | "all"
    onChange: (type: BusinessType | "all") => void
}

export function BusinessTypeFilter({ selected, onChange }: BusinessTypeFilterProps): ReactNode {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {filterOptions.map((option) => (
                <button
                    key={option.value}
                    onClick={(): void => onChange(option.value)}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                        selected === option.value
                            ? "bg-telegram-button text-white shadow-sm"
                            : "bg-telegram-secondary-bg text-telegram-text hover:bg-telegram-button/10",
                    )}
                >
                    <span>{option.emoji}</span>
                    <span>{option.label}</span>
                </button>
            ))}
        </div>
    )
}

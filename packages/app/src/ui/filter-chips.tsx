import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"

export interface FilterOption<T extends string> {
    value: T
    label: string
    /** How many items this chip leaves: the owner sees the queue before tapping. */
    count?: number
}

/**
 * One row of filter chips over a long list (owner's orders, the catalog, «Platforma»): one
 * chip is on, the row scrolls sideways when it does not fit, the counts sit in each chip.
 */
export function FilterChips<T extends string>({
    options,
    value,
    label,
    onChange,
}: {
    options: readonly FilterOption<T>[]
    value: T
    /** What the row filters, for a screen reader. */
    label: string
    onChange(value: T): void
}): React.JSX.Element {
    return (
        <div
            role="group"
            aria-label={label}
            className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
            {options.map((option) => {
                const on = option.value === value
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={on}
                        onClick={(): void => {
                            haptic.select()
                            onChange(option.value)
                        }}
                        className={cn(
                            "tap flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
                            on ? "bg-brand text-brand-ink" : "bg-tg-secondary text-tg-text",
                        )}
                    >
                        {option.label}
                        {option.count === undefined ? null : (
                            // The label's own color (AA on both): the weight sets it apart.
                            <span className="font-normal tabular-nums">{option.count}</span>
                        )}
                    </button>
                )
            })}
        </div>
    )
}

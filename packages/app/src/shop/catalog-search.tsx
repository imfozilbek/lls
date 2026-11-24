import { searchText } from "@zumda/core"
import { useEffect, useRef } from "react"

import { useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"
import { CloseIcon, SearchIcon } from "../ui/icons.js"

import type { ProductDTO } from "@zumda/core"

/** A catalog this long gets a search field; a short one is faster to scroll. */
export const SEARCH_FROM = 20

export function CatalogSearch({
    value,
    onChange,
    onClose,
    className,
}: {
    value: string
    onChange(value: string): void
    /** Opened from the storefront's magnifier: focused at once, «✕» closes it back to the tabs. */
    onClose?: () => void
    className?: string
}): React.JSX.Element {
    const t = useT()
    const input = useRef<HTMLInputElement>(null)
    useEffect(() => {
        if (onClose) {
            input.current?.focus()
        }
    }, [onClose])
    return (
        <div className={cn("relative px-4 pt-1", className)}>
            <SearchIcon
                size={20}
                className="pointer-events-none absolute left-8 top-1/2 mt-0.5 -translate-y-1/2 text-tg-hint"
            />
            <input
                ref={input}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                value={value}
                maxLength={60}
                placeholder={t.shop.search}
                aria-label={t.shop.search}
                onChange={(e): void => onChange(e.target.value)}
                className="field h-12 pl-12 pr-12 shadow-card"
            />
            {value || onClose ? (
                <button
                    type="button"
                    aria-label={t.shop.clearSearch}
                    onClick={(): void => {
                        haptic.select()
                        onChange("")
                        if (onClose) {
                            onClose()
                        } else {
                            input.current?.focus()
                        }
                    }}
                    className="tap absolute right-5 top-1/2 mt-0.5 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-tg-hint"
                >
                    <CloseIcon size={18} />
                </button>
            ) : null}
        </div>
    )
}

/** Each word must start a word of the name or description, Latin or Cyrillic alike. */
export function matches(product: ProductDTO, words: readonly string[]): boolean {
    const text = ` ${searchText(product.name, product.description)}`
    return words.every((word) => text.includes(` ${word}`))
}

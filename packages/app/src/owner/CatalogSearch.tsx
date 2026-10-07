import { useEffect, useState } from "react"

import { fill, useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"
import { useSession } from "../stores/session.js"
import { CategoryIcon, ChevronIcon, SearchIcon } from "../ui/icons.js"

import { loadCatalog, searchCatalog } from "./catalog.js"

import type { Template } from "./catalog.js"

/** Waits this long after the last key: one search per pause, not per letter. */
const TYPING_MS = 120

function useResults(query: string): { results: Template[]; failed: boolean } {
    const type = useSession((state) => state.shop?.type)
    const [results, setResults] = useState<Template[]>([])
    const [failed, setFailed] = useState(false)
    useEffect(() => {
        if (query.trim().length === 0) {
            setResults([])
            return undefined
        }
        let live = true
        const timer = window.setTimeout(() => {
            loadCatalog()
                .then((catalog) => {
                    if (live) {
                        setFailed(false)
                        setResults(searchCatalog(catalog, query, type))
                    }
                })
                .catch(() => live && setFailed(true))
        }, TYPING_MS)
        return (): void => {
            live = false
            window.clearTimeout(timer)
        }
    }, [query, type])
    return { results, failed }
}

/** «Osh va palov · porsiya · 0,5 / 0,7 / 1». */
function TemplateLine({ template }: { template: Template }): React.JSX.Element {
    const t = useT()
    const categories = t.categories as Record<string, string>
    const units = t.units as Record<string, string>
    const parts = [categories[template.category], units[template.unit]]
    if (template.variants.length > 0) {
        parts.push(template.variants.join(" / "))
    }
    return (
        <span className="line-clamp-1 block text-sm text-tg-hint">
            {parts.filter(Boolean).join(" · ")}
        </span>
    )
}

/**
 * The top of a new product: type a few letters, pick a ready product of the Zumda catalog; only
 * the price is left. «… deb o'zim yozaman» keeps the typed words as the name.
 */
export function CatalogSearch({
    onPick,
    onOwn,
}: {
    onPick(template: Template): void
    onOwn(name: string): void
}): React.JSX.Element {
    const t = useT()
    const p = t.owner.product
    const [query, setQuery] = useState("")
    const { results, failed } = useResults(query)
    const typed = query.trim()
    return (
        <section className="flex flex-col gap-2">
            <label
                className={cn(
                    "flex h-14 items-center gap-3 rounded-control bg-tg-secondary px-4 transition-shadow duration-200",
                    "focus-within:bg-tg-bg focus-within:ring-2 focus-within:ring-brand",
                )}
            >
                <SearchIcon size={22} className="shrink-0 text-tg-hint" />
                <input
                    type="search"
                    value={query}
                    autoComplete="off"
                    aria-label={p.catalogSearch}
                    placeholder={p.catalogPlaceholder}
                    className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-tg-hint"
                    onChange={(e): void => setQuery(e.target.value)}
                />
            </label>
            {typed ? null : <p className="px-1 text-sm text-tg-hint">{p.catalogHint}</p>}
            {failed ? <p className="px-1 text-sm text-tg-hint">{p.catalogFailed}</p> : null}
            {results.length > 0 ? (
                <ul className="flex flex-col divide-y divide-tg-separator">
                    {results.map((template) => (
                        <li key={`${template.name}|${template.category}`}>
                            <button
                                type="button"
                                onClick={(): void => {
                                    haptic.select()
                                    onPick(template)
                                }}
                                className="tap flex w-full items-center gap-3 rounded-control py-2.5 text-left"
                            >
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-brand/10 text-brand">
                                    <CategoryIcon category={template.category} size={22} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block font-medium">{template.name}</span>
                                    <TemplateLine template={template} />
                                </span>
                                <ChevronIcon size={18} className="shrink-0 text-tg-hint" />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
            {typed ? (
                <button
                    type="button"
                    onClick={(): void => onOwn(typed)}
                    className="tap flex items-center gap-3 rounded-control bg-tg-secondary px-4 py-3 text-left font-semibold"
                >
                    {fill(p.catalogOwn, { name: typed })}
                </button>
            ) : null}
        </section>
    )
}

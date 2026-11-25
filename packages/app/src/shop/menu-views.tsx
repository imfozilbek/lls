import { useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"
import { ChevronIcon, SearchIcon } from "../ui/icons.js"

import { NEW_CHIP, newShelf, shelvesOf } from "./menu-layout.js"
import { FeedCard, ProductRow, ProductTile } from "./product-cards.js"

import type { Dictionary } from "../i18n/index.js"
import type { ProductDTO } from "@zumda/core"

function chipLabel(t: Dictionary, chip: string): string {
    return chip === NEW_CHIP
        ? t.shop.newArrivals
        : ((t.categories as Record<string, string>)[chip] ?? chip)
}

/** «Hammasi», then the tabs: ages, categories, and «Yangi kelganlar» while its shelf is there. */
export function CategoryChips({
    categories,
    active,
    onChange,
    onSearch,
}: {
    categories: string[]
    active: string | null
    onChange(category: string | null): void
    /** A long catalog: the row starts with the magnifier that opens the search field. */
    onSearch?: () => void
}): React.JSX.Element | null {
    const t = useT()
    const tabs = categories.length >= 2
    if (!tabs && !onSearch) {
        return null
    }
    const chip = (key: string | null, label: string): React.JSX.Element => (
        <button
            key={key ?? "all"}
            type="button"
            onClick={(): void => {
                haptic.select()
                onChange(key)
            }}
            aria-pressed={active === key}
            className={cn(
                "tap h-[38px] shrink-0 rounded-full px-3.5 text-xs font-semibold shadow-card transition-colors duration-200",
                active === key ? "bg-brand text-brand-ink" : "bg-tg-secondary text-tg-text",
            )}
        >
            {label}
        </button>
    )
    return (
        <nav className="sticky top-0 z-sticky flex gap-1.5 overflow-x-auto bg-tg-bg/95 px-4 py-2.5 backdrop-blur [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_85%,transparent)]">
            {onSearch ? (
                <button
                    type="button"
                    aria-label={t.shop.search}
                    onClick={(): void => {
                        haptic.tap()
                        onSearch()
                    }}
                    className="tap grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-tg-secondary shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                    <SearchIcon size={18} />
                </button>
            ) : null}
            {tabs ? chip(null, t.shop.all) : null}
            {tabs ? categories.map((c) => chip(c, chipLabel(t, c))) : null}
        </nav>
    )
}

/** «Ikki ustunda»: two columns of white cards. */
export function GridView({ products }: { products: readonly ProductDTO[] }): React.JSX.Element {
    return (
        <div className="grid grid-cols-2 gap-3 px-4 pt-3">
            {products.map((product, index) => (
                <ProductTile key={product.id} product={product} index={index} />
            ))}
        </div>
    )
}

/** The products of one main category each, in the catalog's order. */
function byCategory(products: readonly ProductDTO[]): { category: string; items: ProductDTO[] }[] {
    const groups = new Map<string, ProductDTO[]>()
    for (const product of products) {
        const group = groups.get(product.category)
        if (group) {
            group.push(product)
        } else {
            groups.set(product.category, [product])
        }
    }
    return [...groups.entries()].map(([category, items]) => ({ category, items }))
}

function RowsCard({ products }: { products: readonly ProductDTO[] }): React.JSX.Element {
    return (
        <ul className="mx-4 divide-y divide-tg-separator overflow-hidden rounded-tile border border-tg-separator bg-tg-secondary">
            {products.map((product) => (
                <ProductRow key={product.id} product={product} />
            ))}
        </ul>
    )
}

/**
 * «Ro'yxat ko'rinishida»: rows in a white card, a card a category under its name; narrowed by a
 * tab or a search, one card of what was found.
 */
export function ListView({
    products,
    grouped,
}: {
    products: readonly ProductDTO[]
    grouped: boolean
}): React.JSX.Element {
    const t = useT()
    const groups = byCategory(products)
    if (!grouped || groups.length < 2) {
        return (
            <div className="pt-3">
                <RowsCard products={products} />
            </div>
        )
    }
    return (
        <div className="flex flex-col gap-1 pt-1">
            {groups.map(({ category, items }) => (
                <section key={category} aria-label={chipLabel(t, category)}>
                    <h2 className="flex items-baseline justify-between px-5 pb-2 pt-4 text-lg font-bold">
                        <span className="min-w-0 truncate">{chipLabel(t, category)}</span>
                        <span className="text-sm font-medium text-tg-hint">{items.length}</span>
                    </h2>
                    <RowsCard products={items} />
                </section>
            ))}
        </div>
    )
}

/** «Katta rasm bilan»: one product a row, its photos large. */
export function FeedView({ products }: { products: readonly ProductDTO[] }): React.JSX.Element {
    return (
        <div className="flex flex-col gap-4 px-4 pt-3">
            {products.map((product, index) => (
                <FeedCard key={product.id} product={product} index={index} />
            ))}
        </div>
    )
}

interface ShelfRow {
    key: string
    title: string
    count?: number
    /** The tab its «Hammasi» presses; none when there are no tabs to come back by. */
    chip?: string
    /** The words of that link: «Hammasi», or «Hammasini ko'rish» for the new ones. */
    more?: string
    items: { product: ProductDTO; anchored: boolean }[]
}

/** The shelves in order, a product anchored where it stands first (a tap scrolls there). */
function shelfRows(
    t: Dictionary,
    catalog: readonly ProductDTO[],
    tabs: readonly string[],
): ShelfRow[] {
    const seen = new Set<string>()
    const mark = (products: readonly ProductDTO[]): ShelfRow["items"] =>
        products.map((product) => {
            const anchored = !seen.has(product.id)
            seen.add(product.id)
            return { product, anchored }
        })
    const withTabs = tabs.length >= 2
    const fresh = newShelf(catalog)
    const rows: ShelfRow[] = []
    if (fresh.length > 0) {
        rows.push({
            key: NEW_CHIP,
            title: t.shop.newArrivals,
            chip: withTabs ? NEW_CHIP : undefined,
            more: t.shop.seeAllNew,
            items: mark(fresh),
        })
    }
    for (const shelf of shelvesOf(catalog)) {
        rows.push({
            key: shelf.category,
            title: chipLabel(t, shelf.category),
            count: shelf.products.length,
            chip: withTabs ? shelf.category : undefined,
            more: t.shop.all,
            items: mark(shelf.products),
        })
    }
    return rows
}

/**
 * «Bo'limlarga ajratilgan»: a shelf a category, swiped sideways, the fullest first; «Yangi
 * kelganlar» leads while the shop has news. «Hammasi» opens a category as two columns.
 */
export function ShelvesView({
    catalog,
    tabs,
    onChip,
}: {
    catalog: readonly ProductDTO[]
    tabs: readonly string[]
    onChip(chip: string): void
}): React.JSX.Element {
    const t = useT()
    return (
        <div className="pb-2">
            {shelfRows(t, catalog, tabs).map((row) => (
                <section key={row.key} aria-label={row.title} className="pt-4">
                    <div className="flex items-center justify-between gap-3 pl-4 pr-2">
                        <h2 className="min-w-0 truncate text-lg font-bold">
                            {row.title}
                            {row.count === undefined ? null : (
                                <span className="ml-1.5 text-base font-medium text-tg-hint">
                                    {row.count}
                                </span>
                            )}
                        </h2>
                        {row.chip === undefined ? null : (
                            <button
                                type="button"
                                aria-label={`${row.more ?? t.shop.all}: ${row.title}`}
                                onClick={(): void => {
                                    haptic.select()
                                    onChip(row.chip ?? "")
                                }}
                                className="tap flex h-11 shrink-0 items-center gap-0.5 rounded-full px-2 text-sm font-semibold text-brand"
                            >
                                {row.more}
                                <ChevronIcon size={16} />
                            </button>
                        )}
                    </div>
                    <div className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {row.items.map(({ product, anchored }) => (
                            <ProductTile
                                key={product.id}
                                product={product}
                                anchored={anchored}
                                className="w-40 shrink-0 snap-start"
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    )
}

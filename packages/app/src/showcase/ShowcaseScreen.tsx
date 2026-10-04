import { SUGGESTED_CATEGORIES } from "@zumda/core"
import { useEffect, useMemo, useRef, useState } from "react"
import { create } from "zustand"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api, imageUrl } from "../lib/api.js"
import { ZUMDA_NAME, readableInk } from "../lib/brand.js"
import { cn } from "../lib/cn.js"
import { formatMoney, hexToRgbChannels } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { usePagedList } from "../lib/paged.js"
import { haptic } from "../lib/telegram.js"
import { ChevronIcon, CloseIcon, SearchIcon, StoreIcon, WifiOffIcon } from "../ui/icons.js"
import { LanguageSwitch } from "../ui/language-switch.js"
import { LoadMore } from "../ui/load-more.js"
import { Button, EmptyState, Skeleton } from "../ui/primitives.js"
import { ProductImage } from "../ui/product-image.js"
import { BottomSpacer } from "../ui/shell.js"
import { ZumdaMark } from "../ui/zumda-mark.js"

import type { Category, ShopPublicDTO, ShowcaseProductDTO } from "@zumda/core"

/** Wait for a pause in typing before asking the server (and D1) again. */
const TYPING_PAUSE_MS = 300
const MIN_QUERY_LENGTH = 2

interface ShowcaseState {
    text: string
    category: Category | null
    setText(text: string): void
    setCategory(category: Category | null): void
}

/** Survives a visit to a shop, so "back" returns to the same search. */
const useShowcase = create<ShowcaseState>((set) => ({
    text: "",
    category: null,
    setText: (text): void => set({ text }),
    setCategory: (category): void => set({ category }),
}))

function useDebounced(value: string): string {
    const [settled, setSettled] = useState(value)
    useEffect(() => {
        const timer = window.setTimeout(() => setSettled(value), TYPING_PAUSE_MS)
        return (): void => window.clearTimeout(timer)
    }, [value])
    return settled
}

/** The shop's letter on its own color, readable in both themes. */
function ShopMark({
    shop,
    size,
}: {
    shop: ShowcaseProductDTO["shop"]
    size: string
}): React.JSX.Element {
    const logo = imageUrl(shop.logoKey)
    if (logo) {
        return (
            <img src={logo} alt="" className={cn(size, "shrink-0 rounded-[0.8rem] object-cover")} />
        )
    }
    return (
        // The shop's name stands next to it: the letter is a picture, not words to read.
        <span
            aria-hidden="true"
            className={cn(size, "grid shrink-0 place-items-center rounded-[0.8rem] font-bold")}
            style={{
                backgroundColor: shop.brandColor,
                color: `rgb(${readableInk(hexToRgbChannels(shop.brandColor) ?? "")})`,
            }}
        >
            {shop.name.trim().charAt(0).toUpperCase()}
        </span>
    )
}

function SearchField(): React.JSX.Element {
    const t = useT()
    const text = useShowcase((state) => state.text)
    const setText = useShowcase((state) => state.setText)
    const input = useRef<HTMLInputElement>(null)
    return (
        <div className="relative">
            <SearchIcon
                size={20}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tg-hint"
            />
            <input
                ref={input}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                value={text}
                maxLength={100}
                placeholder={t.showcase.search}
                aria-label={t.showcase.search}
                onChange={(e): void => setText(e.target.value)}
                className="field h-12 pl-12 pr-12"
            />
            {text ? (
                <button
                    type="button"
                    aria-label={t.showcase.clear}
                    onClick={(): void => {
                        haptic.select()
                        setText("")
                        input.current?.focus()
                    }}
                    className="tap absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-tg-hint"
                >
                    <CloseIcon size={18} />
                </button>
            ) : null}
        </div>
    )
}

function CategoryChips({
    categories,
}: {
    categories: readonly Category[]
}): React.JSX.Element | null {
    const t = useT()
    const active = useShowcase((state) => state.category)
    const setCategory = useShowcase((state) => state.setCategory)
    if (categories.length < 2) {
        return null
    }
    const names = t.categories as Record<string, string>
    const chip = (key: Category | null, label: string): React.JSX.Element => (
        <button
            key={key ?? "all"}
            type="button"
            aria-pressed={active === key}
            onClick={(): void => {
                haptic.select()
                setCategory(active === key ? null : key)
            }}
            className={cn(
                "tap h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors duration-200",
                active === key ? "bg-brand text-brand-ink" : "bg-tg-secondary",
            )}
        >
            {label}
        </button>
    )
    return (
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_85%,transparent)]">
            {chip(null, t.showcase.allCategories)}
            {categories.map((category) => chip(category, names[category] ?? category))}
        </nav>
    )
}

function ShopRow({
    shop,
    index,
    onOpen,
}: {
    shop: ShopPublicDTO
    index: number
    onOpen(slug: string): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const types = t.onboarding.types as Record<string, string>
    const fee =
        shop.delivery.fee === 0
            ? t.shop.deliveryFree
            : fill(t.shop.deliveryFee, { sum: formatMoney(shop.delivery.fee, language) })
    return (
        <li className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
            <button
                type="button"
                onClick={(): void => {
                    haptic.tap()
                    onOpen(shop.slug)
                }}
                className="tap flex w-full items-center gap-3 rounded-tile bg-tg-secondary p-3 text-left"
            >
                <ShopMark shop={shop} size="h-14 w-14 text-xl" />
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{shop.name}</span>
                    <span className="flex items-center gap-1.5 text-sm text-tg-hint">
                        <span
                            className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                shop.isOpen ? "bg-success" : "bg-tg-hint",
                            )}
                        />
                        <span className="truncate">
                            {types[shop.type] ?? shop.type} ·{" "}
                            {shop.isOpen ? t.shop.open : t.shop.closed}
                        </span>
                    </span>
                    <span className="block truncate text-sm text-tg-subtitle">{fee}</span>
                </span>
                <ChevronIcon size={18} className="shrink-0 text-tg-hint" />
            </button>
        </li>
    )
}

function ProductResult({
    product,
    index,
    onOpen,
}: {
    product: ShowcaseProductDTO
    index: number
    onOpen(slug: string): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const unit = (t.units as Record<string, string>)[product.unit] ?? product.unit
    return (
        <li className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
            <button
                type="button"
                onClick={(): void => {
                    haptic.tap()
                    onOpen(product.shop.slug)
                }}
                className="tap flex w-full flex-col text-left"
            >
                <ProductImage
                    imageKey={product.imageKey}
                    category={product.category}
                    alt={product.name}
                    className="aspect-[4/3] w-full rounded-tile"
                />
                <span className="mt-2 line-clamp-2 px-0.5 font-medium leading-snug">
                    {product.name}
                </span>
                <span className="mt-0.5 px-0.5 text-sm">
                    <span className="font-semibold">{formatMoney(product.price, language)}</span>
                    <span className="text-tg-hint"> / {unit}</span>
                </span>
                <span className="mt-1.5 flex items-center gap-1.5 px-0.5 text-sm text-tg-subtitle">
                    <ShopMark shop={product.shop} size="h-5 w-5 text-[0.65rem]" />
                    <span className="truncate">{product.shop.name}</span>
                </span>
            </button>
        </li>
    )
}

function useShops(): { shops: ShopPublicDTO[] | null; error: string | null; retry(): void } {
    const [shops, setShops] = useState<ShopPublicDTO[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [attempt, setAttempt] = useState(0)
    useEffect(() => {
        setError(null)
        api.showcase
            .shops()
            .then((page) => setShops(page.data))
            .catch((caught: unknown) =>
                setError(caught instanceof ApiError ? caught.code : "generic"),
            )
    }, [attempt])
    return { shops, error, retry: (): void => setAttempt((n) => n + 1) }
}

function Results({
    query,
    category,
    onOpen,
}: {
    query: string
    category: Category | null
    onOpen(slug: string): void
}): React.JSX.Element {
    const t = useT()
    const list = usePagedList(`${query}|${category ?? ""}`, (page) =>
        api.showcase.search({ q: query || undefined, category: category ?? undefined }, page),
    )
    if (list.error && list.items === null) {
        return (
            <EmptyState
                art={<WifiOffIcon size={44} />}
                title={errorText(t, list.error)}
                action={
                    <Button variant="secondary" onClick={(): void => void list.reload()}>
                        {t.common.retry}
                    </Button>
                }
            />
        )
    }
    if (list.items === null) {
        return (
            <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="aspect-[4/3] rounded-tile" />
                ))}
            </div>
        )
    }
    if (list.items.length === 0) {
        return (
            <EmptyState
                art={<SearchIcon size={44} />}
                title={t.showcase.emptyTitle}
                text={t.showcase.emptyText}
            />
        )
    }
    return (
        <section aria-live="polite">
            <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
                {list.items.map((product, index) => (
                    <ProductResult
                        key={product.id}
                        product={product}
                        index={index}
                        onOpen={onOpen}
                    />
                ))}
            </ul>
            <LoadMore list={list} />
        </section>
    )
}

function ShopList({
    shops,
    onOpen,
}: {
    shops: ShopPublicDTO[]
    onOpen(slug: string): void
}): React.JSX.Element {
    const t = useT()
    if (shops.length === 0) {
        return (
            <EmptyState
                art={<StoreIcon size={44} />}
                title={t.showcase.noShopsTitle}
                text={t.showcase.noShopsText}
            />
        )
    }
    return (
        <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-tg-subtitle">
                {t.showcase.shops} · {shops.length}
            </h2>
            <ul className="flex flex-col gap-2">
                {shops.map((shop, index) => (
                    <ShopRow key={shop.slug} shop={shop} index={index} onOpen={onOpen} />
                ))}
            </ul>
        </section>
    )
}

/**
 * The Zumda showcase in the Zumda bot: one search across the shops of the district, and the list
 * of shops. A tap opens that shop's own storefront; the order goes to that one shop.
 */
export function ShowcaseScreen({ onOpen }: { onOpen(slug: string): void }): React.JSX.Element {
    const t = useT()
    const text = useShowcase((state) => state.text)
    const category = useShowcase((state) => state.category)
    const query = useDebounced(text.trim())
    const { shops, error, retry } = useShops()
    useMainAction(null)

    // Chips only for kinds of goods the district's shops actually sell.
    const categories = useMemo(
        () => [...new Set((shops ?? []).flatMap((shop) => SUGGESTED_CATEGORIES[shop.type]))],
        [shops],
    )
    const searching = query.length >= MIN_QUERY_LENGTH || category !== null

    let body: React.JSX.Element
    if (searching) {
        body = (
            <Results
                query={query.length >= MIN_QUERY_LENGTH ? query : ""}
                category={category}
                onOpen={onOpen}
            />
        )
    } else if (error) {
        body = (
            <EmptyState
                art={<WifiOffIcon size={44} />}
                title={errorText(t, error)}
                action={
                    <Button variant="secondary" onClick={retry}>
                        {t.common.retry}
                    </Button>
                }
            />
        )
    } else if (shops === null) {
        body = (
            <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 rounded-tile" />
                ))}
            </div>
        )
    } else {
        body = <ShopList shops={shops} onOpen={onOpen} />
    }

    return (
        <main className="flex flex-col gap-4 px-4 pt-4">
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-tg-hint">
                        <ZumdaMark size={18} />
                        {ZUMDA_NAME}
                    </p>
                    <h1 className="text-2xl font-bold leading-tight">{t.showcase.title}</h1>
                    <p className="mt-1 text-sm text-tg-hint">{t.showcase.subtitle}</p>
                </div>
                <LanguageSwitch />
            </header>
            <SearchField />
            <CategoryChips categories={categories} />
            {body}
            <BottomSpacer />
        </main>
    )
}

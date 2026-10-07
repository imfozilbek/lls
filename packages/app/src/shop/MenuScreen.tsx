import {
    WEEKDAYS,
    isFinalStatus,
    isWeightUnit,
    mapUrl,
    searchText,
    searchWords,
    toLocalTime,
} from "@zumda/core"
import { useEffect, useMemo, useRef, useState } from "react"
import { create } from "zustand"

import { fill, useLanguage, useT } from "../i18n/index.js"
import { api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { formatMoney, formatQuantity, kmText } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { haptic } from "../lib/telegram.js"
import { useCachedState } from "../lib/use-cached.js"
import { productOfKey, summarize, useCart } from "../stores/cart.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import {
    BagIcon,
    CloseIcon,
    PinIcon,
    PlusIcon,
    ReceiptIcon,
    SearchIcon,
    StoreIcon,
} from "../ui/icons.js"
import { LanguageSwitch } from "../ui/language-switch.js"
import { MapButton } from "../ui/maps.js"
import { EmptyState, PoweredBy, Stepper } from "../ui/primitives.js"
import { ProductImage } from "../ui/product-image.js"
import { BottomSpacer } from "../ui/shell.js"
import { ShopLogo } from "../ui/shop-logo.js"

import { ProductSheet, hasOptions } from "./ProductSheet.js"

import type { Dictionary } from "../i18n/index.js"
import type { Shop } from "../stores/session.js"
import type { MapMarker } from "../ui/maps.js"
import type { Language, ProductDTO } from "@zumda/core"

function ShopAvatar({ shop }: { shop: Shop }): React.JSX.Element {
    return (
        <ShopLogo
            name={shop.name}
            logoKey={shop.logoKey}
            className="h-14 w-14 rounded-[1.1rem] text-2xl shadow-sm"
        />
    )
}

/** "Today 9:00–22:00" or "day off" in Tashkent time; nothing for shops that are always open. */
function hoursToday(shop: Shop, t: Dictionary): string | null {
    if (shop.workingHours === null) {
        return null
    }
    const day = WEEKDAYS[toLocalTime(new Date()).weekday]
    const range = day ? shop.workingHours[day] : undefined
    return range ? fill(t.shop.hoursToday, { from: range.open, to: range.close }) : t.shop.dayOff
}

/** Short facts customers need before ordering: delivery price, free-from, minimum, hours. */
function shopFacts(shop: Shop, t: Dictionary, language: Language): string[] {
    const { delivery } = shop
    const money = (amount: number): string => formatMoney(amount, language)
    const facts = [
        delivery.fee === 0
            ? t.shop.deliveryFree
            : fill(t.shop.deliveryFee, { sum: money(delivery.fee) }),
    ]
    if (delivery.freeFrom && delivery.fee > 0) {
        facts.push(fill(t.shop.freeFrom, { sum: money(delivery.freeFrom) }))
    }
    if (delivery.minOrder) {
        facts.push(fill(t.shop.minOrder, { sum: money(delivery.minOrder) }))
    }
    if (delivery.radiusMeters !== undefined) {
        facts.push(fill(t.shop.radius, { km: kmText(delivery.radiusMeters) }))
    }
    const hours = hoursToday(shop, t)
    if (hours) {
        facts.push(hours)
    }
    return facts
}

/** A catalog this long gets a search field; a short one is faster to scroll. */
export const SEARCH_FROM = 20

function HeaderAction({
    icon,
    label,
    onClick,
    accent = false,
    badge,
}: {
    icon: React.JSX.Element
    label: string
    onClick(): void
    accent?: boolean
    /** A dot on the button, and these words for screen readers. */
    badge?: string
}): React.JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "tap relative flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 font-medium",
                accent ? "bg-brand/15 text-tg-text" : "bg-tg-secondary",
            )}
        >
            {icon}
            {label}
            {badge ? (
                <>
                    <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-tg-bg" />
                    <span className="sr-only">, {badge}</span>
                </>
            ) : null}
        </button>
    )
}

/** Whether the customer has an order on its way here: «Buyurtmalarim» then wears a dot. */
function useHasActiveOrder(shopId: string | undefined): boolean {
    // Known at once on a return to the menu: the dot never pops in late a second time.
    const [active, setActive] = useCachedState<boolean>("has-active-order")
    useEffect(() => {
        if (!shopId) {
            return undefined
        }
        let alive = true
        api.myOrders()
            .then((page) => {
                if (alive) {
                    setActive(page.data.some((order) => !isFinalStatus(order.status)))
                }
            })
            .catch(() => undefined)
        return (): void => {
            alive = false
        }
    }, [shopId, setActive])
    return active === true
}

export function CatalogSearch({
    value,
    onChange,
}: {
    value: string
    onChange(value: string): void
}): React.JSX.Element {
    const t = useT()
    const input = useRef<HTMLInputElement>(null)
    return (
        <div className="relative px-4 pt-1">
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
                className="field h-12 pl-12 pr-12"
            />
            {value ? (
                <button
                    type="button"
                    aria-label={t.shop.clearSearch}
                    onClick={(): void => {
                        haptic.select()
                        onChange("")
                        input.current?.focus()
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

function ShopHeader({ shop }: { shop: Shop }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const push = useRouter((state) => state.push)
    const hasActiveOrder = useHasActiveOrder(shop.id)
    const status = shop.opensSoon
        ? t.shop.opensSoon
        : shop.paymentMethods.length === 0
          ? t.shop.soon
          : !shop.acceptingOrders
            ? t.shop.paused
            : shop.isOpen
              ? t.shop.open
              : t.shop.closed
    return (
        <header className="px-4 pb-2 pt-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <ShopAvatar shop={shop} />
                    <div className="min-w-0">
                        <h1 className="truncate text-xl font-bold leading-tight">{shop.name}</h1>
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-tg-hint">
                            <span
                                className={cn(
                                    "h-2 w-2 shrink-0 rounded-full",
                                    shop.isOpen ? "bg-success" : "bg-tg-hint",
                                )}
                            />
                            <span className="truncate">{status}</span>
                        </p>
                    </div>
                </div>
                <LanguageSwitch />
            </div>
            <p className="mt-3 text-sm text-tg-subtitle">
                {shopFacts(shop, t, language).join(" · ")}
            </p>
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 text-sm [scrollbar-width:none]">
                <HeaderAction
                    icon={<ReceiptIcon size={16} />}
                    label={t.shop.myOrders}
                    badge={hasActiveOrder ? t.shop.activeOrder : undefined}
                    onClick={(): void => push({ name: "orders" })}
                />
                <ShopMapChip shop={shop} />
                {shop.viewerRole === "owner" ? (
                    <HeaderAction
                        icon={<StoreIcon size={16} />}
                        label={t.shop.manage}
                        onClick={(): void => push({ name: "owner" })}
                        accent
                    />
                ) : null}
            </div>
        </header>
    )
}

/** «Xarita»: where the shop is and how far it delivers (the map loads only on a tap). */
function ShopMapChip({ shop }: { shop: Shop }): React.JSX.Element | null {
    const t = useT()
    const location = shop.location
    const radius = shop.delivery.radiusMeters
    const markers = useMemo(
        (): MapMarker[] =>
            location ? [{ id: "shop", point: location, kind: "shop", title: shop.name }] : [],
        [location, shop.name],
    )
    const zone = useMemo(
        () =>
            location && radius !== undefined ? { center: location, radiusMeters: radius } : null,
        [location, radius],
    )
    if (!location) {
        return null
    }
    return (
        <MapButton
            markers={markers}
            zone={zone}
            href={mapUrl(location)}
            label={t.shop.map}
            className="tap relative flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-tg-secondary px-4 font-medium"
        >
            <PinIcon size={16} />
            {t.shop.map}
        </MapButton>
    )
}

function CategoryChips({
    categories,
    active,
    onChange,
}: {
    categories: string[]
    active: string | null
    onChange(category: string | null): void
}): React.JSX.Element | null {
    const t = useT()
    if (categories.length < 2) {
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
                "tap h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors duration-200",
                active === key ? "bg-brand text-brand-ink" : "bg-tg-secondary text-tg-text",
            )}
        >
            {label}
        </button>
    )
    return (
        <nav className="sticky top-0 z-sticky flex gap-2 overflow-x-auto bg-tg-bg/95 px-4 py-2.5 backdrop-blur [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_85%,transparent)]">
            {chip(null, t.shop.all)}
            {categories.map((c) => chip(c, (t.categories as Record<string, string>)[c] ?? c))}
        </nav>
    )
}

const GLOW_MS = 1800

/** The product opened up close, and the one a showcase tap asked for (it glows a moment). */
const useProductDetail = create<{
    product: ProductDTO | null
    glowId: string | null
    show(product: ProductDTO | null): void
    glow(id: string | null): void
}>((set) => ({
    product: null,
    glowId: null,
    show: (product): void => set({ product }),
    glow: (glowId): void => set({ glowId }),
}))

function openDetail(product: ProductDTO): void {
    haptic.tap()
    useProductDetail.getState().show(product)
}

/** How much of a product is in the cart: every pick of it together when it has options. */
function useInCart(product: ProductDTO): number {
    return useCart((state) =>
        hasOptions(product)
            ? Object.entries(state.lines).reduce(
                  (sum, [key, quantity]) =>
                      productOfKey(key) === product.id ? sum + quantity : sum,
                  0,
              )
            : (state.lines[product.id] ?? 0),
    )
}

/** «/ porsiya», or «dan» for a product whose variants cost differently (from the cheapest). */
function PriceLine({ product }: { product: ProductDTO }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const prices = new Set(product.options?.variants.map((v) => v.price))
    const unit = (t.units as Record<string, string>)[product.unit] ?? product.unit
    return (
        <p className="mt-0.5 text-sm">
            <span className="font-semibold">{formatMoney(product.price, language)}</span>
            <span className="text-tg-hint">
                {prices.size > 1 ? ` ${t.shop.from}` : ` / ${unit}`}
            </span>
        </p>
    )
}

/** A product with options is picked in its sheet: its «+» opens it and shows how many are in. */
function PickButton({
    product,
    quantity,
    className,
}: {
    product: ProductDTO
    quantity: number
    className: string
}): React.JSX.Element {
    const t = useT()
    return (
        <button
            type="button"
            onClick={(): void => openDetail(product)}
            aria-label={`${t.shop.add}: ${product.name}`}
            className={cn("tap grid place-items-center rounded-full", className)}
        >
            {quantity > 0 ? (
                // Weight items count grams: «1,5 kg», never «1500».
                <span
                    className={cn(
                        "font-bold tabular-nums",
                        isWeightUnit(product.unit) ? "text-[0.7rem] leading-tight" : "text-sm",
                    )}
                >
                    {formatQuantity(quantity, product.unit, t.units)}
                </span>
            ) : (
                <PlusIcon size={22} strokeWidth={2.25} />
            )}
        </button>
    )
}

function productAnchor(id: string): string {
    return `product-${id}`
}

/** Opened from the showcase on one product: bring it into view and make it glow once. */
function useFocusedProduct(catalog: readonly ProductDTO[]): void {
    const focusId = useSession((state) => state.focusProductId)
    useEffect(() => {
        if (!focusId || !catalog.some((product) => product.id === focusId)) {
            return undefined
        }
        useSession.getState().focusProduct(null)
        const frame = window.requestAnimationFrame(() => {
            document
                .getElementById(productAnchor(focusId))
                ?.scrollIntoView({ behavior: "smooth", block: "center" })
            useProductDetail.getState().glow(focusId)
        })
        const timer = window.setTimeout(() => useProductDetail.getState().glow(null), GLOW_MS)
        return (): void => {
            window.cancelAnimationFrame(frame)
            window.clearTimeout(timer)
        }
    }, [focusId, catalog])
}

function ProductTile({
    product,
    index,
}: {
    product: ProductDTO
    index: number
}): React.JSX.Element {
    const t = useT()
    const quantity = useInCart(product)
    const add = useCart((state) => state.add)
    const remove = useCart((state) => state.remove)
    const glowing = useProductDetail((state) => state.glowId === product.id)
    return (
        <article
            id={productAnchor(product.id)}
            className={cn(
                "flex animate-rise scroll-mt-24 flex-col rounded-tile transition-shadow duration-500",
                glowing && "ring-2 ring-brand ring-offset-4",
            )}
            style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
        >
            <div className="relative">
                <ProductImage
                    imageKey={product.imageKey}
                    category={product.category}
                    alt={product.name}
                    name={product.name}
                    className="aspect-[4/3] rounded-tile"
                />
                {hasOptions(product) ? (
                    <PickButton
                        product={product}
                        quantity={quantity}
                        className="absolute bottom-2 right-2 h-11 w-11 bg-tg-bg text-brand shadow-md"
                    />
                ) : quantity === 0 ? (
                    <button
                        type="button"
                        onClick={(): void => {
                            haptic.tap()
                            add(product.id, product.step)
                        }}
                        aria-label={`${t.shop.add}: ${product.name}`}
                        className="tap absolute bottom-2 right-2 grid h-11 w-11 place-items-center rounded-full bg-tg-bg text-brand shadow-md"
                    >
                        <PlusIcon size={22} strokeWidth={2.25} />
                    </button>
                ) : (
                    <div className="absolute bottom-2 right-2">
                        <Stepper
                            quantity={quantity}
                            display={formatQuantity(quantity, product.unit, t.units)}
                            onAdd={(): void => add(product.id, product.step)}
                            onRemove={(): void => remove(product.id, product.step)}
                            label={product.name}
                        />
                    </div>
                )}
            </div>
            <button
                type="button"
                onClick={(): void => openDetail(product)}
                className="tap mt-2 rounded-control px-0.5 text-left"
            >
                <h3 className="line-clamp-2 font-medium leading-snug">{product.name}</h3>
                {product.description ? (
                    <p className="mt-0.5 line-clamp-2 text-sm text-tg-hint">
                        {product.description}
                    </p>
                ) : null}
                <PriceLine product={product} />
            </button>
        </article>
    )
}

/**
 * A catalog mostly without photos reads better as a list: name and price at a glance, no wall of
 * letter tiles. One row per product, the same «+» and stepper.
 */
function ProductListRow({ product }: { product: ProductDTO }): React.JSX.Element {
    const t = useT()
    const quantity = useInCart(product)
    const add = useCart((state) => state.add)
    const remove = useCart((state) => state.remove)
    const glowing = useProductDetail((state) => state.glowId === product.id)
    return (
        <li
            id={productAnchor(product.id)}
            className={cn(
                "flex animate-rise scroll-mt-24 items-center gap-3 py-3 transition-shadow duration-500",
                // Rounded only while it glows: a rounded row bends the dividers between rows.
                glowing && "rounded-control ring-2 ring-brand ring-offset-2",
            )}
        >
            <ProductImage
                imageKey={product.imageKey}
                category={product.category}
                alt={product.name}
                iconSize={22}
                className="h-14 w-14 shrink-0 rounded-control"
            />
            <button
                type="button"
                onClick={(): void => openDetail(product)}
                className="tap min-w-0 flex-1 rounded-control text-left"
            >
                <h3 className="line-clamp-2 font-medium leading-snug">{product.name}</h3>
                {product.description ? (
                    <p className="line-clamp-1 text-sm text-tg-hint">{product.description}</p>
                ) : null}
                <PriceLine product={product} />
            </button>
            {hasOptions(product) ? (
                <PickButton
                    product={product}
                    quantity={quantity}
                    className="h-11 w-11 shrink-0 bg-brand/10 text-brand"
                />
            ) : quantity === 0 ? (
                <button
                    type="button"
                    onClick={(): void => {
                        haptic.tap()
                        add(product.id, product.step)
                    }}
                    aria-label={`${t.shop.add}: ${product.name}`}
                    className="tap grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/10 text-brand"
                >
                    <PlusIcon size={22} strokeWidth={2.25} />
                </button>
            ) : (
                <Stepper
                    quantity={quantity}
                    display={formatQuantity(quantity, product.unit, t.units)}
                    onAdd={(): void => add(product.id, product.step)}
                    onRemove={(): void => remove(product.id, product.step)}
                    label={product.name}
                />
            )}
        </li>
    )
}

/** Fewer than half of the products have a photo: the list reads better than tiles. */
function prefersList(catalog: readonly ProductDTO[]): boolean {
    const withPhoto = catalog.filter((product) => product.imageKey).length
    return withPhoto * 2 < catalog.length
}

export function MenuScreen(): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const shop = useSession((state) => state.shop)
    const catalog = useSession((state) => state.catalog)
    const lines = useCart((state) => state.lines)
    const push = useRouter((state) => state.push)
    const [category, setCategory] = useState<string | null>(null)
    const [query, setQuery] = useState("")

    const categories = useMemo(() => [...new Set(catalog.map((p) => p.category))], [catalog])
    // A category that left the catalog (after a refresh) never keeps filtering it empty.
    const active = category && (categories as string[]).includes(category) ? category : null
    const words = searchWords(query)
    const visible = catalog.filter(
        (p) => (!active || p.category === active) && (words.length === 0 || matches(p, words)),
    )
    const cart = summarize(lines, catalog)
    const detail = useProductDetail((state) => state.product)
    useFocusedProduct(catalog)
    // Leaving the menu closes the product: it never pops open again on the next visit.
    useEffect(() => (): void => useProductDetail.getState().show(null), [])

    useMainAction(
        cart.count > 0
            ? {
                  text: `${t.cart.button} · ${cart.count} · ${formatMoney(cart.subtotal, language)}`,
                  onClick: (): void => push({ name: "cart" }),
              }
            : null,
    )

    if (!shop) {
        return <></>
    }
    return (
        <main>
            <ShopHeader shop={shop} />
            {catalog.length > SEARCH_FROM ? (
                <CatalogSearch value={query} onChange={setQuery} />
            ) : null}
            <CategoryChips categories={categories} active={active} onChange={setCategory} />
            {catalog.length === 0 ? (
                <EmptyState
                    art={<BagIcon size={44} />}
                    title={t.shop.emptyTitle}
                    text={t.shop.emptyText}
                />
            ) : visible.length === 0 ? (
                <EmptyState
                    art={<SearchIcon size={44} />}
                    title={t.shop.nothingFound}
                    text={t.shop.nothingFoundText}
                />
            ) : prefersList(catalog) ? (
                <ul className="divide-y divide-tg-separator px-4 pt-1">
                    {visible.map((product) => (
                        <ProductListRow key={product.id} product={product} />
                    ))}
                </ul>
            ) : (
                <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4 pt-3">
                    {visible.map((product, index) => (
                        <ProductTile key={product.id} product={product} index={index} />
                    ))}
                </div>
            )}
            {detail ? (
                <ProductSheet
                    product={detail}
                    onClose={(): void => useProductDetail.getState().show(null)}
                />
            ) : null}
            <PoweredBy />
            <BottomSpacer />
        </main>
    )
}

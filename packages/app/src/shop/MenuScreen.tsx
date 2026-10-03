import { WEEKDAYS, toLocalTime } from "@zumda/core"
import { useMemo, useState } from "react"

import { fill, useLanguage, useT } from "../i18n/index.js"
import { imageUrl } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { formatMoney, formatQuantity } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { haptic } from "../lib/telegram.js"
import { summarize, useCart } from "../stores/cart.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { BagIcon, PlusIcon, ReceiptIcon, StoreIcon } from "../ui/icons.js"
import { LanguageSwitch } from "../ui/language-switch.js"
import { EmptyState, PoweredBy, Stepper } from "../ui/primitives.js"
import { ProductImage } from "../ui/product-image.js"
import { BottomSpacer } from "../ui/shell.js"

import type { Dictionary } from "../i18n/index.js"
import type { Shop } from "../stores/session.js"
import type { Language, ProductDTO } from "@zumda/core"

function ShopAvatar({ shop }: { shop: Shop }): React.JSX.Element {
    const logo = imageUrl(shop.logoKey)
    if (logo) {
        return (
            <img
                src={logo}
                alt=""
                className="h-14 w-14 shrink-0 rounded-[1.1rem] object-cover shadow-sm"
            />
        )
    }
    return (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[1.1rem] bg-brand text-2xl font-bold text-brand-ink">
            {shop.name.trim().charAt(0).toUpperCase()}
        </span>
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
    const hours = hoursToday(shop, t)
    if (hours) {
        facts.push(hours)
    }
    return facts
}

function HeaderAction({
    icon,
    label,
    onClick,
    accent = false,
}: {
    icon: React.JSX.Element
    label: string
    onClick(): void
    accent?: boolean
}): React.JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "tap flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 font-medium",
                accent ? "bg-brand/15 text-tg-text" : "bg-tg-secondary",
            )}
        >
            {icon}
            {label}
        </button>
    )
}

function ShopHeader({ shop }: { shop: Shop }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const push = useRouter((state) => state.push)
    const status = shop.opensSoon
        ? t.shop.opensSoon
        : !shop.hasPayoutCard
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
                    onClick={(): void => push({ name: "orders" })}
                />
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
        <nav className="sticky top-0 z-sticky flex gap-2 overflow-x-auto bg-tg-bg/95 px-4 py-2.5 backdrop-blur [scrollbar-width:none]">
            {chip(null, t.shop.all)}
            {categories.map((c) => chip(c, (t.categories as Record<string, string>)[c] ?? c))}
        </nav>
    )
}

function ProductTile({
    product,
    index,
}: {
    product: ProductDTO
    index: number
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const quantity = useCart((state) => state.lines[product.id] ?? 0)
    const add = useCart((state) => state.add)
    const remove = useCart((state) => state.remove)
    const unit = (t.units as Record<string, string>)[product.unit] ?? product.unit
    return (
        <article
            className="flex animate-rise flex-col"
            style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
        >
            <div className="relative">
                <ProductImage
                    imageKey={product.imageKey}
                    category={product.category}
                    alt={product.name}
                    className="aspect-[4/3] rounded-tile"
                />
                {quantity === 0 ? (
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
                            display={formatQuantity(quantity, product.unit, t.units.kg)}
                            onAdd={(): void => add(product.id, product.step)}
                            onRemove={(): void => remove(product.id, product.step)}
                            label={product.name}
                        />
                    </div>
                )}
            </div>
            <h3 className="mt-2 line-clamp-2 px-0.5 font-medium leading-snug">{product.name}</h3>
            {product.description ? (
                <p className="mt-0.5 line-clamp-2 px-0.5 text-sm text-tg-hint">
                    {product.description}
                </p>
            ) : null}
            <p className="mt-0.5 px-0.5 text-sm">
                <span className="font-semibold">{formatMoney(product.price, language)}</span>
                <span className="text-tg-hint"> / {unit}</span>
            </p>
        </article>
    )
}

export function MenuScreen(): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const shop = useSession((state) => state.shop)
    const catalog = useSession((state) => state.catalog)
    const lines = useCart((state) => state.lines)
    const push = useRouter((state) => state.push)
    const [category, setCategory] = useState<string | null>(null)

    const categories = useMemo(() => [...new Set(catalog.map((p) => p.category))], [catalog])
    const visible = category ? catalog.filter((p) => p.category === category) : catalog
    const cart = summarize(lines, catalog)

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
            <CategoryChips categories={categories} active={category} onChange={setCategory} />
            {catalog.length === 0 ? (
                <EmptyState
                    art={<BagIcon size={44} />}
                    title={t.shop.emptyTitle}
                    text={t.shop.emptyText}
                />
            ) : (
                <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4 pt-3">
                    {visible.map((product, index) => (
                        <ProductTile key={product.id} product={product} index={index} />
                    ))}
                </div>
            )}
            <PoweredBy />
            <BottomSpacer />
        </main>
    )
}

import { LANGUAGES } from "@lls/core"
import { useMemo, useState } from "react"

import { useLanguage, useLanguageStore, useT } from "../i18n/index.js"
import { api, imageUrl } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { formatMoney } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { haptic } from "../lib/telegram.js"
import { summarize, useCart } from "../stores/cart.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { BagIcon, PlusIcon, ReceiptIcon, StoreIcon } from "../ui/icons.js"
import { EmptyState, PoweredBy, Stepper } from "../ui/primitives.js"
import { ProductImage } from "../ui/product-image.js"
import { BottomSpacer } from "../ui/shell.js"

import type { Shop } from "../stores/session.js"
import type { Language, ProductDTO } from "@lls/core"

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

function LanguageSwitch(): React.JSX.Element {
    const language = useLanguage()
    const setLanguage = useLanguageStore((state) => state.setLanguage)
    const choose = (next: Language): void => {
        if (next === language) {
            return
        }
        haptic.select()
        setLanguage(next)
        api.setLanguage(next).catch(() => undefined)
    }
    return (
        <div className="flex rounded-full bg-tg-secondary p-0.5 text-xs font-semibold">
            {LANGUAGES.map((code) => (
                <button
                    key={code}
                    type="button"
                    onClick={(): void => choose(code)}
                    aria-pressed={code === language}
                    className={cn(
                        "tap h-7 rounded-full px-2.5 uppercase transition-colors duration-200",
                        code === language ? "bg-tg-bg text-tg-text shadow-sm" : "text-tg-hint",
                    )}
                >
                    {code}
                </button>
            ))}
        </div>
    )
}

function ShopHeader({ shop }: { shop: Shop }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const push = useRouter((state) => state.push)
    const { delivery } = shop
    const status = !shop.acceptingOrders ? t.shop.paused : shop.isOpen ? t.shop.open : t.shop.closed
    const fee =
        delivery.fee === 0
            ? `${t.shop.delivery} ${t.common.free}`
            : `${t.shop.delivery} ${formatMoney(delivery.fee, language)}`
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
            <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 text-sm [scrollbar-width:none]">
                <span className="shrink-0 rounded-full bg-tg-secondary px-3 py-1.5">{fee}</span>
                {delivery.freeFrom ? (
                    <span className="shrink-0 rounded-full bg-tg-secondary px-3 py-1.5">
                        {language === "uz"
                            ? `${formatMoney(delivery.freeFrom, language)}${t.shop.freeFrom}`
                            : `${t.shop.freeFrom} ${formatMoney(delivery.freeFrom, language)}`}
                    </span>
                ) : null}
                <button
                    type="button"
                    onClick={(): void => push({ name: "orders" })}
                    className="tap flex shrink-0 items-center gap-1.5 rounded-full bg-tg-secondary px-3 py-1.5"
                >
                    <ReceiptIcon size={16} />
                    {t.shop.myOrders}
                </button>
                {shop.viewerRole === "owner" ? (
                    <button
                        type="button"
                        onClick={(): void => push({ name: "owner" })}
                        className="tap flex shrink-0 items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1.5 font-medium text-tg-text"
                    >
                        <StoreIcon size={16} />
                        {t.shop.manage}
                    </button>
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
                "tap h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors duration-200",
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
                            add(product.id)
                        }}
                        aria-label={`${t.shop.add}: ${product.name}`}
                        className="tap absolute bottom-2 right-2 grid h-10 w-10 place-items-center rounded-full bg-tg-bg text-brand shadow-md"
                    >
                        <PlusIcon size={22} strokeWidth={2.25} />
                    </button>
                ) : (
                    <div className="absolute bottom-2 right-2">
                        <Stepper
                            size="sm"
                            quantity={quantity}
                            onAdd={(): void => add(product.id)}
                            onRemove={(): void => remove(product.id)}
                            label={product.name}
                        />
                    </div>
                )}
            </div>
            <h3 className="mt-2 line-clamp-2 px-0.5 font-medium leading-snug">{product.name}</h3>
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

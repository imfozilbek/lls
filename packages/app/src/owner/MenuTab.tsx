import { Feature, searchWords } from "@zumda/core"
import { useEffect, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { formatMoney } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { useRefresh } from "../lib/refresh.js"
import { haptic } from "../lib/telegram.js"
import { CatalogSearch, SEARCH_FROM, matches } from "../shop/MenuScreen.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { BagIcon, ClockIcon, ImageIcon, ListIcon, WifiOffIcon } from "../ui/icons.js"
import { Button, EmptyState, Skeleton, Switch } from "../ui/primitives.js"
import { ProductImage } from "../ui/product-image.js"
import { Sheet, SheetOption } from "../ui/sheet.js"
import { BottomSpacer } from "../ui/shell.js"

import { useOwner } from "./store.js"

import type { ProductDTO } from "@zumda/core"

/** Until the server answers with the real midnight. */
const PLACEHOLDER_STOP_MS = 60 * 60 * 1000

type ProductPatch = Parameters<typeof api.owner.updateProduct>[1]

/** On today's stop-list: the mark is still in the future. */
function stoppedToday(product: ProductDTO): boolean {
    return (
        product.unavailableUntil !== undefined && Date.parse(product.unavailableUntil) > Date.now()
    )
}

/** The "take off sale" choice: only for today, or for good. */
function OffSheet({
    onPick,
    onClose,
}: {
    onPick(patch: ProductPatch): void
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    return (
        <Sheet title={t.owner.offTitle} onClose={onClose}>
            <SheetOption
                label={t.owner.stopToday}
                hint={t.owner.stopTodayHint}
                onClick={(): void => onPick({ stopForToday: true })}
            />
            <SheetOption
                label={t.owner.hideForGood}
                onClick={(): void => onPick({ isAvailable: false })}
            />
        </Sheet>
    )
}

/** The photo, the name and the price (or why it is off sale): a tap opens the editor. */
function ProductSummary({
    product,
    onSale,
    today,
}: {
    product: ProductDTO
    onSale: boolean
    today: boolean
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const push = useRouter((state) => state.push)
    return (
        <button
            type="button"
            onClick={(): void => {
                haptic.tap()
                push({ name: "product", id: product.id })
            }}
            className="tap flex min-w-0 flex-1 items-center gap-3 text-left"
        >
            <ProductImage
                imageKey={product.imageKey}
                category={product.category}
                alt=""
                iconSize={24}
                className={cn(
                    "h-14 w-14 shrink-0 rounded-control transition-opacity duration-200",
                    !onSale && "opacity-40",
                )}
            />
            <span className="min-w-0">
                <span
                    className={cn(
                        "line-clamp-2 font-medium transition-colors duration-200",
                        !onSale && "text-tg-hint",
                    )}
                >
                    {product.name}
                </span>
                <span className="block text-sm text-tg-hint">
                    {onSale
                        ? `${formatMoney(product.price, language)} / ${(t.units as Record<string, string>)[product.unit] ?? product.unit}`
                        : today
                          ? t.owner.stoppedToday
                          : t.owner.hidden}
                </span>
            </span>
        </button>
    )
}

function ProductRow({ product }: { product: ProductDTO }): React.JSX.Element {
    const t = useT()
    const upsert = useOwner((state) => state.upsert)
    const canStop = useSession((state) => state.shop?.features.includes(Feature.STOP_LIST) ?? false)
    const [saving, setSaving] = useState(false)
    const [asking, setAsking] = useState(false)
    const today = stoppedToday(product)
    const onSale = product.isAvailable && !today

    /** True once the server has it. */
    const save = async (patch: ProductPatch): Promise<boolean> => {
        setAsking(false)
        setSaving(true)
        // Optimistic: the switch moves at once, and rolls back if the save fails.
        upsert({
            ...product,
            isAvailable: patch.isAvailable ?? true,
            unavailableUntil: patch.stopForToday
                ? new Date(Date.now() + PLACEHOLDER_STOP_MS).toISOString()
                : undefined,
        })
        try {
            upsert(await api.owner.updateProduct(product.id, patch))
            return true
        } catch (caught) {
            upsert(product)
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
            return false
        } finally {
            setSaving(false)
        }
    }

    return (
        <li className="flex animate-rise items-center gap-3 py-3">
            <ProductSummary product={product} onSale={onSale} today={today} />
            {canStop ? (
                <button
                    type="button"
                    aria-label={fill(t.owner.moreFor, { name: product.name })}
                    onClick={(): void => {
                        haptic.tap()
                        setAsking(true)
                    }}
                    className="tap grid h-11 w-11 shrink-0 place-items-center rounded-full text-tg-subtitle active:bg-tg-secondary"
                >
                    {/* A clock, not «…»: it only takes the item off, for today or for good. */}
                    <ClockIcon size={22} />
                </button>
            ) : null}
            {/* One tap does the everyday thing: off for today where the shop has a stop-list. */}
            <div className="flex w-16 shrink-0 flex-col items-center gap-1">
                <Switch
                    checked={onSale}
                    onChange={(next): void => {
                        if (saving) {
                            return
                        }
                        if (!next && canStop) {
                            void save({ stopForToday: true }).then((saved) => {
                                if (saved) {
                                    toast(fill(t.owner.stoppedTodayToast, { name: product.name }))
                                }
                            })
                            return
                        }
                        void save({ isAvailable: next })
                    }}
                    label={`${t.owner.product.available}: ${product.name}`}
                />
                <span
                    aria-hidden
                    className={cn("text-xs font-medium", onSale ? "text-brand" : "text-tg-hint")}
                >
                    {onSale ? t.owner.onSale : t.owner.offSale}
                </span>
            </div>
            {asking ? (
                <OffSheet
                    onPick={(patch): void => void save(patch)}
                    onClose={(): void => setAsking(false)}
                />
            ) : null}
        </li>
    )
}

/**
 * The owner's catalog by its sections, as customers see it; a search across all of it once the
 * catalog is long, for «off for today» in the middle of a shift.
 */
function ProductGroups({
    products,
    query,
}: {
    products: ProductDTO[]
    query: string
}): React.JSX.Element {
    const t = useT()
    const words = searchWords(query)
    if (words.length > 0) {
        const found = products.filter((product) => matches(product, words))
        return found.length === 0 ? (
            <p className="py-8 text-center text-tg-hint">{t.shop.nothingFound}</p>
        ) : (
            <ul className="divide-y divide-tg-separator">
                {found.map((product) => (
                    <ProductRow key={product.id} product={product} />
                ))}
            </ul>
        )
    }
    const names = t.categories as Record<string, string>
    const sections = [...new Set(products.map((product) => product.category))]
    return (
        <>
            {sections.map((category) => (
                <section key={category} className="pt-3">
                    {sections.length > 1 ? (
                        <h2 className="px-1 pt-2 text-sm font-semibold text-tg-subtitle">
                            {names[category] ?? category}
                        </h2>
                    ) : null}
                    <ul className="divide-y divide-tg-separator">
                        {products
                            .filter((product) => product.category === category)
                            .map((product) => (
                                <ProductRow key={product.id} product={product} />
                            ))}
                    </ul>
                </section>
            ))}
        </>
    )
}

export function MenuTab(): React.JSX.Element {
    const t = useT()
    const [query, setQuery] = useState("")
    const push = useRouter((state) => state.push)
    const products = useOwner((state) => state.products)
    const loadProducts = useOwner((state) => state.loadProducts)
    const [error, setError] = useState<string | null>(null)

    const load = async (): Promise<void> => {
        setError(null)
        try {
            await loadProducts()
        } catch (caught) {
            const code = caught instanceof ApiError ? caught.code : "generic"
            // The menu already on screen stays; only a first load shows the error in its place.
            if (useOwner.getState().products === null) {
                setError(code)
            } else {
                toast(errorText(t, code), "error")
            }
        }
    }
    useEffect(() => {
        void load()
    }, [])
    useRefresh(load)

    useMainAction({
        text: t.owner.addProduct,
        onClick: (): void => push({ name: "product", id: null }),
    })

    if (error) {
        return (
            <EmptyState
                art={<WifiOffIcon size={44} />}
                title={errorText(t, error)}
                action={
                    <Button variant="secondary" onClick={(): void => void load()}>
                        {t.common.retry}
                    </Button>
                }
            />
        )
    }
    if (products === null) {
        return (
            <div className="flex flex-col gap-3 px-4 pt-3">
                {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14" />
                ))}
            </div>
        )
    }
    if (products.length === 0) {
        return (
            <EmptyState
                art={<BagIcon size={44} />}
                title={t.owner.menuEmpty}
                text={t.owner.menuEmptyText}
                action={
                    <Button variant="secondary" onClick={(): void => push({ name: "bulk" })}>
                        {t.owner.product.bulk}
                    </Button>
                }
            />
        )
    }
    const noPhoto = products.filter((product) => !product.imageKey).length
    return (
        <section className="px-4">
            {products.length > SEARCH_FROM ? (
                <div className="-mx-4 mt-2">
                    <CatalogSearch value={query} onChange={setQuery} />
                </div>
            ) : null}
            {noPhoto > 0 ? (
                // A photo sells: the storefront without them looks like a price list.
                <p className="mt-2 flex items-center gap-2 rounded-control bg-brand/10 px-3 py-2.5 text-sm">
                    <ImageIcon size={18} className="shrink-0 text-brand" />
                    {fill(t.owner.addPhotos, { n: noPhoto })}
                </p>
            ) : null}
            <button
                type="button"
                onClick={(): void => push({ name: "bulk" })}
                className="tap mt-2 flex min-h-11 w-full items-center gap-2 rounded-control px-1 text-sm font-semibold text-brand active:bg-brand/10"
            >
                <ListIcon size={18} />
                {t.owner.product.bulk}
            </button>
            <ProductGroups products={products} query={query} />
            <BottomSpacer />
        </section>
    )
}

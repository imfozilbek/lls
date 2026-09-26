import { Feature, Unit } from "@lls/core"
import { useEffect, useState } from "react"

import { errorText, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { formatMoney } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { haptic } from "../lib/telegram.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { BagIcon, WifiOffIcon } from "../ui/icons.js"
import { Button, EmptyState, Skeleton, Switch } from "../ui/primitives.js"
import { ProductImage } from "../ui/product-image.js"
import { Sheet, SheetOption } from "../ui/sheet.js"
import { BottomSpacer } from "../ui/shell.js"

import { useOwner } from "./store.js"

import type { ProductDTO } from "@lls/core"

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

function ProductRow({ product }: { product: ProductDTO }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const push = useRouter((state) => state.push)
    const upsert = useOwner((state) => state.upsert)
    const canStop = useSession((state) => state.shop?.features.includes(Feature.STOP_LIST) ?? false)
    const [saving, setSaving] = useState(false)
    const [asking, setAsking] = useState(false)
    const today = stoppedToday(product)
    const onSale = product.isAvailable && !today

    const save = async (patch: ProductPatch): Promise<void> => {
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
        } catch (caught) {
            upsert(product)
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setSaving(false)
        }
    }

    return (
        <li className="flex animate-rise items-center gap-3 py-3">
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
                    <span className="line-clamp-1 font-medium">{product.name}</span>
                    <span className="block text-sm text-tg-hint">
                        {onSale
                            ? `${formatMoney(product.price, language)}${product.unit === Unit.KG ? ` / ${t.units.kg}` : ""}`
                            : today
                              ? t.owner.stoppedToday
                              : t.owner.hidden}
                    </span>
                </span>
            </button>
            <Switch
                checked={onSale}
                onChange={(next): void => {
                    if (saving) {
                        return
                    }
                    if (!next && canStop) {
                        haptic.tap()
                        setAsking(true)
                        return
                    }
                    void save({ isAvailable: next })
                }}
                label={`${t.owner.product.available}: ${product.name}`}
            />
            {asking ? (
                <OffSheet
                    onPick={(patch): void => void save(patch)}
                    onClose={(): void => setAsking(false)}
                />
            ) : null}
        </li>
    )
}

export function MenuTab(): React.JSX.Element {
    const t = useT()
    const push = useRouter((state) => state.push)
    const products = useOwner((state) => state.products)
    const loadProducts = useOwner((state) => state.loadProducts)
    const [error, setError] = useState<string | null>(null)

    const load = async (): Promise<void> => {
        setError(null)
        try {
            await loadProducts()
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "generic")
        }
    }
    useEffect(() => {
        void load()
    }, [])

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
            />
        )
    }
    return (
        <section className="px-4">
            <ul className="divide-y divide-tg-separator">
                {products.map((product) => (
                    <ProductRow key={product.id} product={product} />
                ))}
            </ul>
            <BottomSpacer />
        </section>
    )
}

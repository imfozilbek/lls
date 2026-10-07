import { useState } from "react"

import { fill, useLanguage, useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { formatMoney } from "../lib/format.js"
import { haptic } from "../lib/telegram.js"
import { lineKey, lineTotal, pickPrice, useCart } from "../stores/cart.js"
import { CheckIcon } from "../ui/icons.js"
import { Button, Stepper } from "../ui/primitives.js"

import type { ProductDTO } from "@zumda/core"

/** A variant: one of a row of tiles, the price under the name. */
function VariantTiles({
    product,
    value,
    onChange,
}: {
    product: ProductDTO
    value: string | undefined
    onChange(id: string): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const variants = product.options?.variants ?? []
    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 px-1 text-sm font-semibold text-tg-hint">
                {product.options?.group ?? t.shop.variant}
            </legend>
            <div className="grid grid-cols-3 gap-2">
                {variants.map((variant) => (
                    <button
                        key={variant.id}
                        type="button"
                        role="radio"
                        aria-checked={variant.id === value}
                        onClick={(): void => {
                            haptic.select()
                            onChange(variant.id)
                        }}
                        className={cn(
                            "tap rounded-control px-2 py-2.5 text-center transition-colors duration-200",
                            variant.id === value
                                ? "bg-brand/10 text-brand ring-2 ring-inset ring-brand"
                                : "bg-tg-secondary",
                        )}
                    >
                        <span className="block font-semibold leading-tight">{variant.name}</span>
                        <span className="block text-sm tabular-nums opacity-80">
                            {formatMoney(variant.price, language)}
                        </span>
                    </button>
                ))}
            </div>
        </fieldset>
    )
}

/** Add-ons: a checklist, «+4 000» or «bepul» on the right. */
function AddonList({
    product,
    value,
    onToggle,
}: {
    product: ProductDTO
    value: readonly string[]
    onToggle(id: string): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    return (
        <fieldset>
            <legend className="mb-1 px-1 text-sm font-semibold text-tg-hint">
                {t.shop.addons}
            </legend>
            <ul className="divide-y divide-tg-separator">
                {(product.options?.addons ?? []).map((addon) => {
                    const on = value.includes(addon.id)
                    return (
                        <li key={addon.id}>
                            <button
                                type="button"
                                role="checkbox"
                                aria-checked={on}
                                onClick={(): void => {
                                    haptic.select()
                                    onToggle(addon.id)
                                }}
                                className="tap flex min-h-12 w-full items-center gap-3 rounded-control px-1 text-left"
                            >
                                <span
                                    className={cn(
                                        "grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors duration-150",
                                        on
                                            ? "border-brand bg-brand text-brand-ink"
                                            : "border-tg-separator",
                                    )}
                                >
                                    {on ? <CheckIcon size={16} strokeWidth={2.5} /> : null}
                                </span>
                                <span className="flex-1">{addon.name}</span>
                                <span className="tabular-nums text-tg-hint">
                                    {addon.price > 0
                                        ? `+${formatMoney(addon.price, language)}`
                                        : t.common.free}
                                </span>
                            </button>
                        </li>
                    )
                })}
            </ul>
        </fieldset>
    )
}

/**
 * The pick of a product with variants and add-ons, inside its sheet: a variant (the cheapest
 * first chosen), add-ons, how many, and «Savatga · sum». The server prices it again.
 */
export function OptionsPicker({
    product,
    onDone,
}: {
    product: ProductDTO
    onDone(): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const add = useCart((state) => state.add)
    const variants = product.options?.variants ?? []
    const cheapest = [...variants].sort((a, b) => a.price - b.price)[0]
    const [variantId, setVariantId] = useState(cheapest?.id)
    const [addonIds, setAddonIds] = useState<string[]>([])
    const [count, setCount] = useState(1)
    const pick = { ...(variantId ? { variantId } : {}), addonIds }
    const unitPrice = pickPrice(product, pick)?.unitPrice ?? product.price
    const toggle = (id: string): void =>
        setAddonIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
    return (
        <div className="flex flex-col gap-4">
            {variants.length > 0 ? (
                <VariantTiles product={product} value={variantId} onChange={setVariantId} />
            ) : null}
            {(product.options?.addons.length ?? 0) > 0 ? (
                <AddonList product={product} value={addonIds} onToggle={toggle} />
            ) : null}
            <div className="flex items-center gap-3">
                <Stepper
                    quantity={count}
                    onAdd={(): void => setCount((n) => Math.min(n + 1, 99))}
                    onRemove={(): void => setCount((n) => Math.max(n - 1, 1))}
                    label={product.name}
                />
                <Button
                    className="flex-1"
                    onClick={(): void => {
                        haptic.success()
                        const key = lineKey(product.id, pick)
                        for (let i = 0; i < count; i++) {
                            add(key, product.step)
                        }
                        onDone()
                    }}
                >
                    {fill(t.shop.toCart, {
                        sum: formatMoney(
                            lineTotal(product, product.step * count, unitPrice),
                            language,
                        ),
                    })}
                </Button>
            </div>
        </div>
    )
}

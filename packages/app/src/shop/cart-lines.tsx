import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { formatMoney, formatQuantity } from "../lib/format.js"
import { opensWhen } from "../lib/opening.js"
import { takesOrdersNow } from "../lib/shop-ready.js"
import { confirm } from "../lib/telegram.js"
import { useCart } from "../stores/cart.js"
import { TrashIcon } from "../ui/icons.js"
import { Stepper } from "../ui/primitives.js"
import { ProductImage } from "../ui/product-image.js"

import type { Dictionary } from "../i18n/index.js"
import type { CartLine, DeliveryRules, summarize } from "../stores/cart.js"
import type { Shop } from "../stores/session.js"
import type { Language } from "@zumda/core"

function Line({ line, faded }: { line: CartLine; faded?: boolean }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const add = useCart((state) => state.add)
    const remove = useCart((state) => state.remove)
    const setQuantity = useCart((state) => state.setQuantity)
    const { product } = line
    return (
        <li className="flex animate-rise items-center gap-3 py-3">
            <ProductImage
                imageKey={product.imageKey}
                category={product.category}
                alt=""
                iconSize={24}
                className={
                    faded
                        ? "h-14 w-14 shrink-0 rounded-control opacity-50"
                        : "h-14 w-14 shrink-0 rounded-control"
                }
            />
            <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium leading-snug">{product.name}</p>
                {line.label ? (
                    <p className="line-clamp-2 text-sm text-tg-subtitle">{line.label}</p>
                ) : null}
                <p className="mt-0.5 text-sm text-tg-hint">
                    {faded ? t.cart.unavailable : formatMoney(line.total, language)}
                </p>
            </div>
            {faded ? (
                <button
                    type="button"
                    onClick={(): void => setQuantity(line.key, 0)}
                    aria-label={t.common.delete}
                    className="tap grid h-11 w-11 place-items-center rounded-full bg-tg-secondary text-tg-hint"
                >
                    <TrashIcon size={18} />
                </button>
            ) : (
                <Stepper
                    quantity={line.quantity}
                    display={formatQuantity(line.quantity, product.unit, t.units)}
                    onAdd={(): void => add(line.key, product.step)}
                    onRemove={(): void => remove(line.key, product.step)}
                    label={product.name}
                />
            )}
        </li>
    )
}

/** One friendly hint: how much is left to the minimum order or to free delivery. */
export function nudgeText(
    t: Dictionary,
    language: Language,
    subtotal: number,
    rules: DeliveryRules,
): string | null {
    if (rules.minOrder !== undefined && subtotal < rules.minOrder) {
        return fill(t.cart.minOrderLeft, { sum: formatMoney(rules.minOrder - subtotal, language) })
    }
    if (rules.freeFrom !== undefined && rules.fee > 0 && subtotal < rules.freeFrom) {
        return fill(t.cart.freeDeliveryLeft, {
            sum: formatMoney(rules.freeFrom - subtotal, language),
        })
    }
    return null
}

/** Why the shop takes no order right now, in the words the Worker would use. */
export function closedReason(shop: Shop | null): string {
    if (shop?.opensSoon) {
        return "SHOP_NOT_ACTIVE"
    }
    if (shop && !shop.acceptingOrders) {
        return "NOT_ACCEPTING_ORDERS"
    }
    if (shop && shop.paymentMethods.length === 0) {
        return "NO_PAYOUT_CARD"
    }
    return "SHOP_CLOSED"
}

/** The shop takes no order now: said under the cart, before anything is filled in. */
export function closedText(t: Dictionary, shop: Shop | null): string | null {
    if (shop && takesOrdersNow(shop)) {
        return null
    }
    const reason = closedReason(shop)
    if (reason === "SHOP_NOT_ACTIVE") {
        return t.shop.opensSoon
    }
    const when = reason === "SHOP_CLOSED" ? opensWhen(t, shop?.workingHours ?? null) : null
    return when ? fill(t.cart.closedUntil, { when }) : errorText(t, reason)
}

/**
 * The top of the order screen: what is in the cart, each line with its stepper, and one nudge
 * (the minimum order, free delivery). «Savatni tozalash» asks first: the whole cart in one tap.
 */
export function CartLines({
    cart,
    rules,
    shop,
}: {
    cart: ReturnType<typeof summarize>
    rules: DeliveryRules
    shop: Shop | null
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const clear = useCart((state) => state.clear)
    const nudge = nudgeText(t, language, cart.subtotal, rules)
    const closed = closedText(t, shop)
    return (
        <section aria-label={t.cart.title}>
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">{t.cart.title}</h1>
                <button
                    type="button"
                    onClick={(): void => {
                        void confirm(t.cart.clearAsk, {
                            yes: t.cart.clear,
                            no: t.common.no,
                            destructive: true,
                        }).then((yes) => {
                            if (yes) {
                                clear()
                            }
                        })
                    }}
                    className="tap -mr-2 inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-tg-subtitle active:bg-tg-secondary"
                >
                    {t.cart.clear}
                </button>
            </div>
            <ul className="mt-1 divide-y divide-tg-separator">
                {cart.lines.map((line) => (
                    <Line key={line.key} line={line} />
                ))}
                {cart.unavailable.map((line) => (
                    <Line key={line.key} line={line} faded />
                ))}
            </ul>
            {nudge ? (
                <p className="mt-2 rounded-control bg-brand/10 px-4 py-3 text-sm font-medium">
                    {nudge}
                </p>
            ) : null}
            {closed ? (
                <p className="mt-2 rounded-control bg-warning/15 px-4 py-3 text-sm font-medium">
                    {closed}
                </p>
            ) : null}
        </section>
    )
}

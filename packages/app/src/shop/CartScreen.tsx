import { fill, useLanguage, useT } from "../i18n/index.js"
import { formatMoney, formatQuantity } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { deliveryFee, summarize, useCart } from "../stores/cart.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { BagIcon, TrashIcon } from "../ui/icons.js"
import { Button, EmptyState, Stepper } from "../ui/primitives.js"
import { ProductImage } from "../ui/product-image.js"
import { BottomSpacer } from "../ui/shell.js"

import type { Dictionary } from "../i18n/index.js"
import type { CartLine, DeliveryRules } from "../stores/cart.js"
import type { Shop } from "../stores/session.js"
import type { Language } from "@lls/core"

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
                        ? "h-16 w-16 shrink-0 rounded-control opacity-50"
                        : "h-16 w-16 shrink-0 rounded-control"
                }
            />
            <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium leading-snug">{product.name}</p>
                <p className="mt-0.5 text-sm text-tg-hint">
                    {faded ? t.cart.unavailable : formatMoney(line.total, language)}
                </p>
            </div>
            {faded ? (
                <button
                    type="button"
                    onClick={(): void => setQuantity(product.id, 0)}
                    aria-label={t.common.delete}
                    className="tap grid h-11 w-11 place-items-center rounded-full bg-tg-secondary text-tg-hint"
                >
                    <TrashIcon size={18} />
                </button>
            ) : (
                <Stepper
                    quantity={line.quantity}
                    display={formatQuantity(line.quantity, product.unit, t.units.kg)}
                    onAdd={(): void => add(product.id, product.step)}
                    onRemove={(): void => remove(product.id, product.step)}
                    label={product.name}
                />
            )}
        </li>
    )
}

function Row({
    label,
    value,
    strong,
}: {
    label: string
    value: string
    strong?: boolean
}): React.JSX.Element {
    return (
        <div
            className={
                strong
                    ? "flex justify-between text-lg font-bold"
                    : "flex justify-between text-tg-subtitle"
            }
        >
            <span>{label}</span>
            <span className="tabular-nums">{value}</span>
        </div>
    )
}

/** One friendly hint: how much is left to the minimum order or to free delivery. */
function nudgeText(
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

function Totals({ subtotal, fee }: { subtotal: number; fee: number }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    return (
        <div className="mt-5 flex flex-col gap-2 rounded-tile bg-tg-secondary p-4">
            <Row label={t.cart.subtotal} value={formatMoney(subtotal, language)} />
            <Row
                label={t.cart.delivery}
                value={fee === 0 ? t.common.free : formatMoney(fee, language)}
            />
            <div className="my-1 h-px bg-tg-separator" />
            <Row label={t.cart.total} value={formatMoney(subtotal + fee, language)} strong />
        </div>
    )
}

function ClosedNote({ shop }: { shop: Shop | null }): React.JSX.Element | null {
    const t = useT()
    if (!shop || shop.isOpen) {
        return null
    }
    return (
        <p className="mt-3 text-center text-sm text-tg-hint">
            {!shop.hasPayoutCard
                ? t.errors.NO_PAYOUT_CARD
                : shop.acceptingOrders
                  ? t.errors.SHOP_CLOSED
                  : t.errors.NOT_ACCEPTING_ORDERS}
        </p>
    )
}

export function CartScreen(): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const shop = useSession((state) => state.shop)
    const catalog = useSession((state) => state.catalog)
    const lines = useCart((state) => state.lines)
    const clear = useCart((state) => state.clear)
    const { push, back } = useRouter.getState()

    const cart = summarize(lines, catalog)
    const rules: DeliveryRules = shop?.delivery ?? { fee: 0 }
    const fee = deliveryFee(cart.subtotal, rules)
    const belowMinimum = rules.minOrder !== undefined && cart.subtotal < rules.minOrder
    const canOrder = cart.count > 0 && !belowMinimum && Boolean(shop?.isOpen)

    useMainAction(
        cart.count > 0
            ? {
                  text: `${t.cart.checkout} · ${formatMoney(cart.subtotal + fee, language)}`,
                  onClick: (): void => push({ name: "checkout" }),
                  disabled: !canOrder,
              }
            : null,
    )

    if (cart.count === 0 && cart.unavailable.length === 0) {
        return (
            <EmptyState
                art={<BagIcon size={44} />}
                title={t.cart.empty}
                text={t.cart.emptyText}
                action={
                    <Button variant="secondary" onClick={back}>
                        {t.cart.toMenu}
                    </Button>
                }
            />
        )
    }

    const nudge = nudgeText(t, language, cart.subtotal, rules)
    return (
        <main className="px-4 pt-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">{t.cart.title}</h1>
                <button
                    type="button"
                    onClick={clear}
                    className="tap text-sm font-medium text-tg-hint"
                >
                    {t.cart.clear}
                </button>
            </div>
            <ul className="mt-2 divide-y divide-tg-separator">
                {cart.lines.map((line) => (
                    <Line key={line.product.id} line={line} />
                ))}
                {cart.unavailable.map((line) => (
                    <Line key={line.product.id} line={line} faded />
                ))}
            </ul>
            {nudge ? (
                <p className="mt-3 rounded-control bg-brand/10 px-4 py-3 text-sm font-medium">
                    {nudge}
                </p>
            ) : null}
            <Totals subtotal={cart.subtotal} fee={fee} />
            <ClosedNote shop={shop} />
            <BottomSpacer />
        </main>
    )
}

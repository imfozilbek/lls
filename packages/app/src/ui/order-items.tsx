import { fill, useLanguage, useT } from "../i18n/index.js"
import { orderDelivery } from "../lib/delivery-price.js"
import { formatMoney, quantityMark } from "../lib/format.js"
import { deliveryWords } from "../shop/delivery-words.js"

import { LinePhoto, useProductSheet } from "./line-photo.js"

import type { OrderDTO, OrderItemDTO, ProductDTO } from "@zumda/core"

/**
 * Lines, delivery, bottle deposit and total of an order. Shared by customer, owner and courier.
 * With the shop's `products`, each line starts with its product's photo, which opens it.
 */
export function OrderItems({
    order,
    products,
    inset = false,
}: {
    order: OrderDTO
    products?: ReadonlyMap<string, ProductDTO>
    /** Inside a card (the courier's): its inner color, so the lines never melt into the card. */
    inset?: boolean
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const productSheet = useProductSheet()
    const photo = (item: OrderItemDTO): React.ReactNode =>
        products ? (
            <LinePhoto
                item={item}
                product={products.get(item.productId)}
                onOpen={productSheet.open}
            />
        ) : null
    return (
        <div className={inset ? "rounded-tile bg-tg-bg p-4" : "rounded-tile bg-tg-secondary p-4"}>
            <ul className="flex flex-col gap-2">
                {order.items.map((item) => (
                    <li
                        key={item.line}
                        className={products ? "flex items-center gap-3" : "flex gap-3"}
                    >
                        {photo(item)}
                        <span className="shrink-0 font-semibold tabular-nums text-tg-hint">
                            {quantityMark(item.quantity, item.unit, t.units)}
                        </span>
                        <span className="min-w-0 flex-1">
                            {item.name}
                            {item.options ? (
                                <span className="block text-sm text-tg-subtitle">
                                    {item.options.label}
                                </span>
                            ) : null}
                        </span>
                        <span className="shrink-0 tabular-nums">
                            {formatMoney(item.total, language)}
                        </span>
                    </li>
                ))}
            </ul>
            {order.removedItems?.length ? (
                <ul className="mt-2 flex flex-col gap-1 text-tg-hint">
                    {order.removedItems.map((item) => (
                        <li
                            key={item.line}
                            className={products ? "flex items-center gap-3" : "flex gap-3"}
                        >
                            {photo(item)}
                            <span className="shrink-0 font-semibold tabular-nums line-through">
                                {quantityMark(item.quantity, item.unit, t.units)}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="line-through">{item.name}</span>
                                <span className="block text-sm">{t.order.missingItem}</span>
                            </span>
                            <span className="shrink-0 tabular-nums line-through">
                                {formatMoney(item.total, language)}
                            </span>
                        </li>
                    ))}
                </ul>
            ) : null}
            <div className="my-3 h-px bg-tg-separator" />
            <OrderTotals order={order} />
            {productSheet.sheet}
        </div>
    )
}

/** Delivery, bottle deposit, total and the bottles to give back. */
function OrderTotals({ order }: { order: OrderDTO }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const delivery = orderDelivery(order)
    return (
        <>
            {delivery === null ? null : (
                <div className="flex justify-between text-tg-subtitle">
                    <span>{t.cart.delivery}</span>
                    <span className="tabular-nums">
                        {delivery === "later"
                            ? deliveryWords(language).apart
                            : delivery === "free"
                              ? t.common.free
                              : formatMoney(delivery, language)}
                    </span>
                </div>
            )}
            {order.depositTotal > 0 ? (
                <div className="mt-1 flex justify-between text-tg-subtitle">
                    <span>{t.cart.deposit}</span>
                    <span className="tabular-nums">
                        {formatMoney(order.depositTotal, language)}
                    </span>
                </div>
            ) : null}
            <div className="mt-1 flex justify-between text-lg font-bold">
                <span>{t.cart.total}</span>
                <span className="tabular-nums">{formatMoney(order.total, language)}</span>
            </div>
            {order.bottlesReturned > 0 ? (
                <p className="mt-2 text-sm text-tg-subtitle">
                    {fill(t.order.bottlesBack, { n: order.bottlesReturned })}
                </p>
            ) : null}
        </>
    )
}

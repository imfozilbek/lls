import { fill, useLanguage, useT } from "../i18n/index.js"
import { formatMoney, formatQuantity } from "../lib/format.js"

import type { OrderDTO } from "@zumda/core"

/** Lines, delivery, bottle deposit and total of an order. Shared by customer, owner and courier. */
export function OrderItems({ order }: { order: OrderDTO }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    return (
        <div className="rounded-tile bg-tg-secondary p-4">
            <ul className="flex flex-col gap-2">
                {order.items.map((item, line) => (
                    <li key={line} className="flex gap-3">
                        <span className="shrink-0 font-semibold tabular-nums text-tg-hint">
                            {formatQuantity(item.quantity, item.unit, t.units)}×
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
            <div className="my-3 h-px bg-tg-separator" />
            <div className="flex justify-between text-tg-subtitle">
                <span>{t.cart.delivery}</span>
                <span className="tabular-nums">
                    {order.deliveryFee === 0
                        ? t.common.free
                        : formatMoney(order.deliveryFee, language)}
                </span>
            </div>
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
        </div>
    )
}

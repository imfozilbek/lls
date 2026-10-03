import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { api } from "../lib/api.js"
import { formatMoney, formatTime } from "../lib/format.js"
import { usePagedList } from "../lib/paged.js"
import { haptic } from "../lib/telegram.js"
import { useRouter } from "../stores/router.js"
import { ChevronIcon, ReceiptIcon, WifiOffIcon } from "../ui/icons.js"
import { LoadMore } from "../ui/load-more.js"
import { OrderBadge } from "../ui/order-status.js"
import { Button, EmptyState, Skeleton } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import { useReorder } from "./reorder.js"

import type { OrderDTO } from "@zumda/core"

function OrderRow({ order, index }: { order: OrderDTO; index: number }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const push = useRouter((state) => state.push)
    const reorder = useReorder(order)
    const preview = `${fill(t.order.itemsCount, { n: order.items.length })} · ${order.items
        .map((item) => item.name)
        .join(", ")}`
    return (
        <li
            className="flex animate-rise flex-col gap-1.5"
            style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
        >
            <button
                type="button"
                onClick={(): void => {
                    haptic.tap()
                    push({ name: "order", id: order.id })
                }}
                className="tap flex w-full items-center gap-3 rounded-tile bg-tg-secondary p-4 text-left"
            >
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                            {fill(t.order.title, { n: order.number })}
                        </span>
                        <OrderBadge order={order} />
                    </div>
                    <p className="mt-1 truncate text-sm text-tg-hint">{preview}</p>
                    <p className="mt-2 flex justify-between text-sm">
                        <span className="text-tg-hint">
                            {formatTime(order.createdAt, language)}
                        </span>
                        <span className="font-semibold tabular-nums">
                            {formatMoney(order.total, language)}
                        </span>
                    </p>
                </div>
                <ChevronIcon size={18} className="shrink-0 text-tg-hint" />
            </button>
            {reorder ? (
                <button
                    type="button"
                    onClick={reorder}
                    className="tap h-11 self-end rounded-full px-4 text-sm font-semibold text-brand"
                >
                    {t.order.reorder}
                </button>
            ) : null}
        </li>
    )
}

export function OrdersScreen(): React.JSX.Element {
    const t = useT()
    const back = useRouter((state) => state.back)
    const list = usePagedList("orders", (page) => api.myOrders(page))
    const orders = list.items

    let body: React.JSX.Element
    if (list.error && orders === null) {
        body = (
            <EmptyState
                art={<WifiOffIcon size={44} />}
                title={errorText(t, list.error)}
                action={
                    <Button variant="secondary" onClick={(): void => void list.reload()}>
                        {t.common.retry}
                    </Button>
                }
            />
        )
    } else if (orders === null) {
        body = (
            <div className="mt-4 flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-[104px] rounded-tile" />
                ))}
            </div>
        )
    } else if (orders.length === 0) {
        body = (
            <EmptyState
                art={<ReceiptIcon size={44} />}
                title={t.order.historyEmpty}
                text={t.order.historyEmptyText}
                action={
                    <Button variant="secondary" onClick={back}>
                        {t.cart.toMenu}
                    </Button>
                }
            />
        )
    } else {
        body = (
            <>
                <ul className="mt-4 flex flex-col gap-3">
                    {orders.map((order, index) => (
                        <OrderRow key={order.id} order={order} index={index} />
                    ))}
                </ul>
                <LoadMore list={list} />
            </>
        )
    }

    return (
        <main className="px-4 pt-4">
            <h1 className="text-2xl font-bold">{t.order.history}</h1>
            {body}
            <BottomSpacer />
        </main>
    )
}

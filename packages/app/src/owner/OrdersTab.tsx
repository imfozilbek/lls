import { isFinalStatus } from "@lls/core"
import { useCallback, useEffect, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { formatMoney, formatTime } from "../lib/format.js"
import { confirm, haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { PhoneIcon, PinIcon, ReceiptIcon, WifiOffIcon } from "../ui/icons.js"
import { StatusBadge } from "../ui/order-status.js"
import { Button, EmptyState, Segmented, Skeleton } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import type { OrderDTO, OrderStatus } from "@lls/core"

type Filter = "active" | "done"

/** New orders also arrive as bot messages; the list refreshes calmly while it is open. */
const POLL_MS = 20_000

function mapLink(order: OrderDTO): string | null {
    const point = order.location
    return point ? `https://maps.google.com/?q=${point.latitude},${point.longitude}` : null
}

function OrderActions({
    order,
    onChange,
}: {
    order: OrderDTO
    onChange(order: OrderDTO): void
}): React.JSX.Element | null {
    const t = useT()
    const [busy, setBusy] = useState<OrderStatus | null>(null)
    if (isFinalStatus(order.status)) {
        return null
    }

    const move = async (status: OrderStatus): Promise<void> => {
        if (status === "cancelled" && !(await confirm(`${t.owner.cancelOrder}?`))) {
            return
        }
        setBusy(status)
        try {
            onChange(await api.owner.setStatus(order.id, status))
            haptic.success()
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setBusy(null)
        }
    }

    const next = order.nextStatus
    const actions = t.owner.actions as Record<string, string>
    return (
        <div className="mt-4 flex gap-2">
            {next ? (
                <Button
                    className="flex-1"
                    loading={busy === next}
                    disabled={busy !== null}
                    onClick={(): void => void move(next)}
                >
                    {actions[next] ?? next}
                </Button>
            ) : null}
            <Button
                variant="danger"
                loading={busy === "cancelled"}
                disabled={busy !== null}
                onClick={(): void => void move("cancelled" as OrderStatus)}
            >
                {t.owner.cancelOrder}
            </Button>
        </div>
    )
}

function OrderCard({
    order,
    onChange,
}: {
    order: OrderDTO
    onChange(order: OrderDTO): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const map = mapLink(order)
    return (
        <li className="animate-rise rounded-tile bg-tg-secondary p-4">
            <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-bold">
                    {fill(t.order.title, { n: order.number })}
                </span>
                <StatusBadge status={order.status} />
            </div>
            <p className="text-sm text-tg-hint">
                {formatTime(order.createdAt, language)} · {order.customerName}
            </p>
            <ul className="mt-3 flex flex-col gap-1">
                {order.items.map((item) => (
                    <li key={item.productId} className="flex gap-2">
                        <span className="w-7 shrink-0 font-semibold tabular-nums">
                            {item.quantity}×
                        </span>
                        <span className="flex-1">{item.name}</span>
                    </li>
                ))}
            </ul>
            <p className="mt-2 flex justify-between font-semibold">
                <span>{t.cart.total}</span>
                <span className="tabular-nums">{formatMoney(order.total, language)}</span>
            </p>
            <div className="mt-3 flex gap-2 rounded-control bg-tg-bg p-3 text-sm">
                <PinIcon size={18} className="mt-0.5 shrink-0 text-brand" />
                <div className="min-w-0">
                    <p className="font-medium">{order.address}</p>
                    {order.landmark ? <p className="text-tg-hint">{order.landmark}</p> : null}
                    {order.comment ? <p className="mt-1 italic">«{order.comment}»</p> : null}
                </div>
            </div>
            <div className="mt-3 flex gap-2">
                {order.customerPhone ? (
                    <a
                        href={`tel:${order.customerPhone}`}
                        className="tap flex h-11 flex-1 items-center justify-center gap-2 rounded-control bg-tg-bg font-semibold"
                    >
                        <PhoneIcon size={18} className="text-brand" />
                        {t.owner.call}
                    </a>
                ) : null}
                {map ? (
                    <a
                        href={map}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tap flex h-11 flex-1 items-center justify-center gap-2 rounded-control bg-tg-bg font-semibold"
                    >
                        <PinIcon size={18} className="text-brand" />
                        {t.owner.map}
                    </a>
                ) : null}
            </div>
            <OrderActions order={order} onChange={onChange} />
        </li>
    )
}

function useShopOrders(filter: Filter): {
    orders: OrderDTO[] | null
    error: string | null
    reload(): Promise<void>
    replace(order: OrderDTO): void
} {
    const [orders, setOrders] = useState<OrderDTO[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    const reload = useCallback(async (): Promise<void> => {
        try {
            setOrders((await api.owner.orders(filter)).data)
            setError(null)
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "generic")
        }
    }, [filter])

    useEffect(() => {
        setOrders(null)
        void reload()
        if (filter !== "active") {
            return undefined
        }
        const timer = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void reload()
            }
        }, POLL_MS)
        return (): void => window.clearInterval(timer)
    }, [filter, reload])

    const replace = (order: OrderDTO): void =>
        setOrders((list) => list?.map((o) => (o.id === order.id ? order : o)) ?? null)

    return { orders, error, reload, replace }
}

export function OrdersTab(): React.JSX.Element {
    const t = useT()
    const [filter, setFilter] = useState<Filter>("active")
    const { orders, error, reload, replace } = useShopOrders(filter)

    let body: React.JSX.Element
    if (error) {
        body = (
            <EmptyState
                art={<WifiOffIcon size={44} />}
                title={errorText(t, error)}
                action={
                    <Button variant="secondary" onClick={(): void => void reload()}>
                        {t.common.retry}
                    </Button>
                }
            />
        )
    } else if (orders === null) {
        body = (
            <div className="flex flex-col gap-3">
                {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-64 rounded-tile" />
                ))}
            </div>
        )
    } else if (orders.length === 0) {
        body = (
            <EmptyState
                art={<ReceiptIcon size={44} />}
                title={filter === "active" ? t.owner.noActive : t.owner.noDone}
                text={filter === "active" ? t.owner.noActiveText : undefined}
            />
        )
    } else {
        body = (
            <ul className="flex flex-col gap-3">
                {orders.map((order) => (
                    <OrderCard key={order.id} order={order} onChange={replace} />
                ))}
            </ul>
        )
    }

    return (
        <section className="flex flex-col gap-4 px-4 pt-2">
            <Segmented<Filter>
                value={filter}
                onChange={setFilter}
                options={[
                    { value: "active", label: t.owner.active },
                    { value: "done", label: t.owner.done },
                ]}
            />
            {body}
            <BottomSpacer />
        </section>
    )
}

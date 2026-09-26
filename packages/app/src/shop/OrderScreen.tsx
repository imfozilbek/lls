import { isFinalStatus } from "@lls/core"
import { useCallback, useEffect, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { formatMoney, formatTime } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { confirm, haptic } from "../lib/telegram.js"
import { useRouter } from "../stores/router.js"
import { toast } from "../stores/toast.js"
import { PinIcon, WifiOffIcon } from "../ui/icons.js"
import { StatusHero, StatusTimeline } from "../ui/order-status.js"
import { Button, EmptyState, Section, Skeleton } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import type { OrderDTO } from "@lls/core"

/** Status changes arrive by bot message too, so a calm 20 s refresh is enough (free-tier friendly). */
const POLL_MS = 20_000

function useOrder(id: string): {
    order: OrderDTO | null
    error: string | null
    reload(): Promise<void>
    setOrder(order: OrderDTO): void
} {
    const [order, setOrder] = useState<OrderDTO | null>(null)
    const [error, setError] = useState<string | null>(null)

    const reload = useCallback(async (): Promise<void> => {
        try {
            setOrder(await api.order(id))
            setError(null)
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "generic")
        }
    }, [id])

    const active = order !== null && !isFinalStatus(order.status)
    useEffect(() => {
        void reload()
    }, [reload])
    useEffect(() => {
        if (!active) {
            return undefined
        }
        const timer = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void reload()
            }
        }, POLL_MS)
        return (): void => window.clearInterval(timer)
    }, [active, reload])

    return { order, error, reload, setOrder }
}

function OrderSkeleton(): React.JSX.Element {
    return (
        <main className="flex flex-col items-center gap-4 px-4 pt-10">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="mt-6 h-40 w-full rounded-tile" />
        </main>
    )
}

function Items({ order }: { order: OrderDTO }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const units = t.units as Record<string, string>
    return (
        <div className="rounded-tile bg-tg-secondary p-4">
            <ul className="flex flex-col gap-2">
                {order.items.map((item) => (
                    <li key={item.productId} className="flex gap-3">
                        <span className="w-8 shrink-0 font-semibold tabular-nums text-tg-hint">
                            {item.quantity}×
                        </span>
                        <span className="min-w-0 flex-1">
                            {item.name}
                            <span className="text-tg-hint"> · {units[item.unit] ?? item.unit}</span>
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
            <div className="mt-1 flex justify-between text-lg font-bold">
                <span>{t.cart.total}</span>
                <span className="tabular-nums">{formatMoney(order.total, language)}</span>
            </div>
        </div>
    )
}

function Address({ order }: { order: OrderDTO }): React.JSX.Element {
    return (
        <div className="flex gap-3 rounded-tile bg-tg-secondary p-4">
            <PinIcon size={20} className="mt-0.5 shrink-0 text-brand" />
            <div className="min-w-0">
                <p className="font-medium">{order.address}</p>
                {order.landmark ? <p className="text-sm text-tg-hint">{order.landmark}</p> : null}
                {order.comment ? (
                    <p className="mt-1 text-sm italic text-tg-subtitle">«{order.comment}»</p>
                ) : null}
            </div>
        </div>
    )
}

export function OrderScreen({
    id,
    justPlaced = false,
}: {
    id: string
    justPlaced?: boolean
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const reset = useRouter((state) => state.reset)
    const { order, error, reload, setOrder } = useOrder(id)
    const [cancelling, setCancelling] = useState(false)

    // After placing, the big button leads back to the menu; the order stays in "My orders".
    useMainAction(
        justPlaced && order ? { text: t.cart.toMenu, onClick: (): void => reset() } : null,
    )

    const cancel = async (): Promise<void> => {
        if (!(await confirm(t.order.cancelConfirm))) {
            return
        }
        setCancelling(true)
        try {
            setOrder(await api.cancelOrder(id))
            haptic.success()
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
            await reload()
        } finally {
            setCancelling(false)
        }
    }

    if (!order) {
        if (!error) {
            return <OrderSkeleton />
        }
        return (
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
    }

    const celebrate = justPlaced && order.status === "pending"
    return (
        <main className="flex flex-col gap-6 px-4">
            <StatusHero
                status={order.status}
                title={celebrate ? t.order.placedTitle : undefined}
                hint={celebrate ? t.order.placedText : undefined}
            />

            <div className="flex items-baseline justify-between px-1">
                <h2 className="text-lg font-bold">{fill(t.order.title, { n: order.number })}</h2>
                <span className="text-sm text-tg-hint">
                    {formatTime(order.createdAt, language)}
                </span>
            </div>

            {order.status !== "cancelled" ? (
                <div className="px-1">
                    <StatusTimeline status={order.status} />
                </div>
            ) : order.cancelReason ? (
                <p className="rounded-control bg-danger/10 px-4 py-3 text-sm">
                    {order.cancelReason}
                </p>
            ) : null}

            <Section title={t.order.items}>
                <Items order={order} />
            </Section>
            <Section title={t.order.address}>
                <Address order={order} />
            </Section>

            {order.status === "pending" ? (
                <Button
                    variant="danger"
                    className="w-full"
                    loading={cancelling}
                    onClick={(): void => void cancel()}
                >
                    {t.order.cancel}
                </Button>
            ) : null}
            <BottomSpacer />
        </main>
    )
}

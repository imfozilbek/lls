import { OrderStatus } from "@lls/core"
import { useCallback, useEffect, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { formatMoney } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { haptic } from "../lib/telegram.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { AddressBlock, ContactLinks } from "../ui/contact-links.js"
import { CheckIcon, ClockIcon, ScooterIcon, WifiOffIcon } from "../ui/icons.js"
import { OrderItems } from "../ui/order-items.js"
import { StatusBadge } from "../ui/order-status.js"
import { Button, EmptyState, PoweredBy, Skeleton } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import type { OrderDTO } from "@lls/core"

const POLL_MS = 20_000

/** The one step a courier makes next, if any. */
function courierStep(status: OrderStatus): "picked_up" | "delivered" | null {
    if (status === OrderStatus.READY) {
        return "picked_up"
    }
    return status === OrderStatus.PICKED_UP ? "delivered" : null
}

function isActive(order: OrderDTO): boolean {
    return order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.CANCELLED
}

function StepButton({
    order,
    onChange,
    onStale,
}: {
    order: OrderDTO
    onChange(order: OrderDTO): void
    onStale(): void
}): React.JSX.Element {
    const t = useT()
    const [busy, setBusy] = useState(false)
    const step = courierStep(order.status)
    if (!step) {
        return (
            <p className="flex items-center gap-2 rounded-control bg-tg-bg p-3 text-sm text-tg-hint">
                <ClockIcon size={18} className="shrink-0" />
                {t.courier.waitReady}
            </p>
        )
    }
    const go = async (): Promise<void> => {
        setBusy(true)
        try {
            onChange(await api.courier.setStatus(order.id, step))
            haptic.success()
        } catch (caught) {
            haptic.error()
            const code = caught instanceof ApiError ? caught.code : "generic"
            toast(errorText(t, code), "error")
            // Someone else moved or reassigned it: show the truth.
            onStale()
        } finally {
            setBusy(false)
        }
    }
    return (
        <Button
            size="lg"
            loading={busy}
            icon={step === "delivered" ? <CheckIcon size={20} /> : <ScooterIcon size={20} />}
            onClick={(): void => void go()}
        >
            {step === "delivered" ? t.courier.delivered : t.courier.pickedUp}
        </Button>
    )
}

function DeliveryCard({
    order,
    onChange,
    onStale,
}: {
    order: OrderDTO
    onChange(order: OrderDTO): void
    onStale(): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    return (
        <li className="flex animate-rise flex-col gap-3 rounded-tile bg-tg-secondary p-4">
            <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-bold">#{order.number}</span>
                <StatusBadge status={order.status} />
            </div>
            <p className="font-medium">{order.customerName}</p>
            <AddressBlock order={order} />
            <ContactLinks order={order} />
            <div className="flex items-baseline justify-between rounded-control bg-brand/10 px-4 py-3">
                <span className="font-medium">{t.courier.collect}</span>
                <span className="text-xl font-bold tabular-nums">
                    {formatMoney(order.total, language)}
                </span>
            </div>
            {order.bottlesReturned > 0 ? (
                <p className="px-1 font-medium">
                    {fill(t.courier.bottles, { n: order.bottlesReturned })}
                </p>
            ) : null}
            <details className="group">
                <summary className="tap cursor-pointer list-none px-1 py-2 text-sm font-medium text-tg-link">
                    {t.order.items} · {order.items.length}
                </summary>
                <OrderItems order={order} />
            </details>
            <StepButton order={order} onChange={onChange} onStale={onStale} />
        </li>
    )
}

function DoneRow({ order }: { order: OrderDTO }): React.JSX.Element {
    const language = useLanguage()
    return (
        <li className="flex items-center gap-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                <CheckIcon size={18} />
            </span>
            <span className="min-w-0 flex-1 truncate">
                #{order.number} · {order.address}
            </span>
            <span className="shrink-0 tabular-nums text-tg-hint">
                {formatMoney(order.total, language)}
            </span>
        </li>
    )
}

/** Active deliveries plus today's delivered ones; refreshes calmly while on screen. */
function useDeliveries(): {
    orders: OrderDTO[] | null
    error: string | null
    reload(): Promise<void>
    replace(order: OrderDTO): void
} {
    const [orders, setOrders] = useState<OrderDTO[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const reload = useCallback(async (): Promise<void> => {
        try {
            setOrders((await api.courier.orders()).data)
            setError(null)
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "generic")
        }
    }, [])
    useEffect(() => {
        void reload()
        const timer = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void reload()
            }
        }, POLL_MS)
        return (): void => window.clearInterval(timer)
    }, [reload])
    const replace = (order: OrderDTO): void =>
        setOrders((list) => list?.map((o) => (o.id === order.id ? order : o)) ?? null)
    return { orders, error, reload, replace }
}

function Title(): React.JSX.Element {
    const t = useT()
    const shop = useSession((state) => state.shop)
    return (
        <header className="pb-1 pt-4">
            <p className="text-sm text-tg-hint">{shop?.name}</p>
            <h1 className="text-2xl font-bold">{t.courier.title}</h1>
        </header>
    )
}

/** The courier's own screen: what to deliver now, and what is done today. */
export function CourierApp(): React.JSX.Element {
    const t = useT()
    const { orders, error, reload, replace } = useDeliveries()
    useMainAction(null)

    if (error && orders === null) {
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
    const active = orders?.filter(isActive) ?? []
    const done = orders?.filter((o) => o.status === OrderStatus.DELIVERED) ?? []
    return (
        <main className="flex flex-col gap-4 px-4">
            <Title />
            {orders === null ? <Skeleton className="h-72 rounded-tile" /> : null}
            {orders !== null && active.length === 0 ? (
                <EmptyState
                    art={<ScooterIcon size={44} />}
                    title={t.courier.empty}
                    text={t.courier.emptyText}
                />
            ) : null}
            {active.length > 0 ? (
                <ul className="flex flex-col gap-3" aria-label={t.courier.active}>
                    {active.map((order) => (
                        <DeliveryCard
                            key={order.id}
                            order={order}
                            onChange={replace}
                            onStale={(): void => void reload()}
                        />
                    ))}
                </ul>
            ) : null}
            {done.length > 0 ? (
                <section>
                    <h2 className="px-1 text-sm font-semibold text-tg-subtitle">
                        {t.courier.doneToday} · {done.length}
                    </h2>
                    <ul className="divide-y divide-tg-separator">
                        {done.map((order) => (
                            <DoneRow key={order.id} order={order} />
                        ))}
                    </ul>
                </section>
            ) : null}
            <PoweredBy />
            <BottomSpacer />
        </main>
    )
}

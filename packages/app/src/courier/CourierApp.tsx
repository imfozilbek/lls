import { OrderStatus, PaidWith, PaymentMethod, PaymentStatus } from "@lls/core"
import { useCallback, useEffect, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { formatMoney } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { haptic } from "../lib/telegram.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { AddressBlock, ContactLinks } from "../ui/contact-links.js"
import { CashIcon, CheckIcon, ClockIcon, ScooterIcon, WifiOffIcon } from "../ui/icons.js"
import { OrderItems } from "../ui/order-items.js"
import { StatusBadge } from "../ui/order-status.js"
import { Button, EmptyState, PoweredBy, Skeleton } from "../ui/primitives.js"
import { Sheet, SheetOption } from "../ui/sheet.js"
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
    const [asking, setAsking] = useState(false)
    const step = courierStep(order.status)
    if (!step) {
        return (
            <p className="flex items-center gap-2 rounded-control bg-tg-bg p-3 text-sm text-tg-hint">
                <ClockIcon size={18} className="shrink-0" />
                {t.courier.waitReady}
            </p>
        )
    }
    const go = async (paidWith?: PaidWith): Promise<void> => {
        // At the door the courier says how the customer paid: it decides who holds the money.
        if (step === "delivered" && !paidWith && order.payment.status !== PaymentStatus.PAID) {
            setAsking(true)
            return
        }
        setBusy(true)
        try {
            onChange(await api.courier.setStatus(order.id, step, paidWith))
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
    const options = [
        { value: PaidWith.CASH, label: t.owner.paidCash },
        { value: PaidWith.CARD_TRANSFER, label: t.owner.paidCard },
        { value: PaidWith.LATER, label: t.owner.paidLater },
    ]
    return (
        <>
            <Button
                size="lg"
                loading={busy}
                icon={step === "delivered" ? <CheckIcon size={20} /> : <ScooterIcon size={20} />}
                onClick={(): void => void go()}
            >
                {step === "delivered" ? t.courier.delivered : t.courier.pickedUp}
            </Button>
            {asking ? (
                <Sheet title={t.courier.howPaid} onClose={(): void => setAsking(false)}>
                    {options.map((option) => (
                        <SheetOption
                            key={option.value}
                            label={option.label}
                            onClick={(): void => {
                                setAsking(false)
                                void go(option.value)
                            }}
                        />
                    ))}
                </Sheet>
            ) : null}
        </>
    )
}

/** What to take at the door: the total in cash, or nothing when it is paid or transferred. */
function Collect({ order }: { order: OrderDTO }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    if (order.payment.status === PaymentStatus.PAID) {
        return (
            <p className="flex items-center gap-2 rounded-control bg-success/15 px-4 py-3 font-medium">
                <CheckIcon size={20} className="shrink-0 text-success" />
                {t.courier.nothingToCollect}
            </p>
        )
    }
    if (order.payment.method === PaymentMethod.CARD_TRANSFER) {
        return (
            <p className="flex items-center gap-2 rounded-control bg-warning/15 px-4 py-3 font-medium">
                <ClockIcon size={20} className="shrink-0 text-warning" />
                {t.courier.collectTransfer}
            </p>
        )
    }
    return (
        <div className="flex items-baseline justify-between rounded-control bg-brand/10 px-4 py-3">
            <span className="font-medium">{t.courier.collect}</span>
            <span className="text-xl font-bold tabular-nums">
                {formatMoney(order.total, language)}
            </span>
        </div>
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
    return (
        <li className="flex animate-rise flex-col gap-3 rounded-tile bg-tg-secondary p-4">
            <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-bold">#{order.number}</span>
                <StatusBadge status={order.status} />
            </div>
            <p className="font-medium">{order.customerName}</p>
            <AddressBlock order={order} />
            <ContactLinks order={order} />
            <Collect order={order} />
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
    onHand: number
    error: string | null
    reload(): Promise<void>
    replace(order: OrderDTO): void
} {
    const [orders, setOrders] = useState<OrderDTO[] | null>(null)
    const [onHand, setOnHand] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const reload = useCallback(async (): Promise<void> => {
        try {
            const [list, cash] = await Promise.all([api.courier.orders(), api.courier.cash()])
            setOrders(list.data)
            setOnHand(cash.onHand)
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
    const replace = (order: OrderDTO): void => {
        setOrders((list) => list?.map((o) => (o.id === order.id ? order : o)) ?? null)
        // Cash taken at the door adds to what the courier holds.
        api.courier
            .cash()
            .then((cash) => setOnHand(cash.onHand))
            .catch(() => undefined)
    }
    return { orders, onHand, error, reload, replace }
}

function Title({ onHand }: { onHand: number }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const shop = useSession((state) => state.shop)
    return (
        <header className="pb-1 pt-4">
            <p className="text-sm text-tg-hint">{shop?.name}</p>
            <h1 className="text-2xl font-bold">{t.courier.title}</h1>
            {onHand > 0 ? (
                <p className="mt-2 inline-flex animate-rise items-center gap-2 rounded-full bg-brand/15 px-3 py-1.5 text-sm font-semibold">
                    <CashIcon size={18} className="text-brand" />
                    {fill(t.courier.onHand, { sum: formatMoney(onHand, language) })}
                </p>
            ) : null}
        </header>
    )
}

/** The courier's own screen: what to deliver now, and what is done today. */
export function CourierApp(): React.JSX.Element {
    const t = useT()
    const { orders, onHand, error, reload, replace } = useDeliveries()
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
            <Title onHand={onHand} />
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

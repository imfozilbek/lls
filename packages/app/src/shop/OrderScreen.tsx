import { OrderStatus, PaymentStatus, isFinalStatus } from "@zumda/core"
import { useCallback, useEffect, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { formatMoney, formatTime } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { confirm, haptic } from "../lib/telegram.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { AlertIcon, CheckIcon, PinIcon, ScooterIcon, WifiOffIcon } from "../ui/icons.js"
import { OrderItems } from "../ui/order-items.js"
import { StatusHero, StatusTimeline } from "../ui/order-status.js"
import { CardBlock, PaymentLine } from "../ui/payment.js"
import { Button, EmptyState, Section, Skeleton } from "../ui/primitives.js"
import { ReceiptThumb } from "../ui/receipt.js"
import { BottomSpacer } from "../ui/shell.js"

import { ReceiptSheet } from "./ReceiptSheet.js"
import { useReorder } from "./reorder.js"

import type { Dictionary } from "../i18n/index.js"
import type { OrderDTO } from "@zumda/core"

/** Status changes arrive by bot message too, so a calm 20 s refresh is enough (free-tier friendly). */
const POLL_MS = 20_000

/**
 * Paid before the shop starts: until then the shop's card stays at hand with «O'tkazdim», which
 * asks for the screenshot of the transfer. After it the customer sees that the shop is checking,
 * and the screenshot they sent; «Pul kelmadi» from the shop brings the card back with a clear why.
 */
function Payment({
    order,
    onChange,
}: {
    order: OrderDTO
    onChange(order: OrderDTO): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    // The card this order was shown: the owner may have switched the payment card since.
    const shopCard = useSession((state) => state.shop?.payoutCard)
    const card = order.payment.card ?? shopCard
    const [sheet, setSheet] = useState(false)
    const open = order.status !== OrderStatus.CANCELLED
    const unpaid = open && order.payment.status === PaymentStatus.UNPAID
    const checking = open && order.payment.status === PaymentStatus.AWAITING
    const rejected = unpaid && order.payment.rejections > 0
    const sentAt = order.payment.receipt?.at

    return (
        <Section title={t.pay.title}>
            <PaymentLine
                order={order}
                className="rounded-control bg-tg-secondary px-4 py-3 text-base"
            />
            {rejected ? (
                <div className="flex animate-rise gap-3 rounded-control bg-warning/15 px-4 py-3">
                    <AlertIcon size={20} className="mt-0.5 shrink-0 text-warning" />
                    <div>
                        <p className="font-semibold">{t.pay.rejectedTitle}</p>
                        <p className="text-sm">{t.pay.rejectedText}</p>
                    </div>
                </div>
            ) : null}
            {unpaid && card ? <CardBlock card={card} total={order.total} /> : null}
            {unpaid ? (
                <Button
                    size="lg"
                    className="w-full"
                    icon={<CheckIcon size={20} />}
                    onClick={(): void => {
                        haptic.tap()
                        setSheet(true)
                    }}
                >
                    {rejected ? t.pay.resend : t.pay.sent}
                </Button>
            ) : null}
            {checking ? (
                <div className="flex animate-fade-in gap-3 rounded-control bg-tg-secondary p-3">
                    <ReceiptThumb orderId={order.id} sentAt={sentAt} />
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold">{t.pay.checkingTitle}</p>
                        <p className="text-sm text-tg-subtitle">{t.pay.checkingTime}</p>
                        {sentAt ? (
                            <p className="text-sm text-tg-hint">
                                {fill(t.pay.sentAt, { time: formatTime(sentAt, language) })}
                            </p>
                        ) : null}
                        <button
                            type="button"
                            onClick={(): void => {
                                haptic.tap()
                                setSheet(true)
                            }}
                            className="tap -ml-1 mt-1 min-h-11 rounded-control px-1 text-sm font-semibold text-brand"
                        >
                            {t.pay.replace}
                        </button>
                    </div>
                </div>
            ) : null}
            {sheet ? (
                <ReceiptSheet
                    order={order}
                    onSent={onChange}
                    onClose={(): void => setSheet(false)}
                />
            ) : null}
        </Section>
    )
}

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

/** Under the order: repeat a finished one, or cancel while the shop has not accepted it yet. */
function OrderActions({
    order,
    onChange,
    onStale,
}: {
    order: OrderDTO
    onChange(order: OrderDTO): void
    onStale(): Promise<void>
}): React.JSX.Element | null {
    const t = useT()
    const reorder = useReorder(order)
    const [cancelling, setCancelling] = useState(false)

    const cancel = async (): Promise<void> => {
        if (!(await confirm(t.order.cancelConfirm))) {
            return
        }
        setCancelling(true)
        try {
            onChange(await api.cancelOrder(order.id))
            haptic.success()
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
            await onStale()
        } finally {
            setCancelling(false)
        }
    }

    if (reorder) {
        return (
            <Button variant="secondary" className="w-full" onClick={reorder}>
                {t.order.reorder}
            </Button>
        )
    }
    // Quiet and far from «O'tkazdim»: a mistaken tap here costs the order.
    if (order.status === OrderStatus.PENDING) {
        return (
            <Button
                variant="ghost"
                className="mx-auto text-sm font-medium text-tg-destructive"
                loading={cancelling}
                onClick={(): void => void cancel()}
            >
                {t.order.cancel}
            </Button>
        )
    }
    return null
}

/** A new order is about the money: waiting for it, the shop checking it, or not found. */
function heroText(
    order: OrderDTO,
    t: Dictionary,
    justPlaced: boolean,
    sum: string,
): { title?: string; hint?: string } {
    if (order.status !== OrderStatus.PENDING) {
        return {}
    }
    if (order.payment.status === PaymentStatus.AWAITING) {
        return { title: t.pay.checkingTitle, hint: t.pay.checkingTime }
    }
    if (order.payment.rejections > 0) {
        return { title: t.pay.rejectedTitle, hint: t.pay.rejectedText }
    }
    return {
        title: justPlaced ? t.order.placedTitle : `${t.pay.waitingTitle} · ${sum}`,
        hint: justPlaced ? t.order.placedText : t.pay.waitingHint,
    }
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

    // After placing, the big button leads back to the menu; the order stays in "My orders".
    useMainAction(
        justPlaced && order ? { text: t.cart.toMenu, onClick: (): void => reset() } : null,
    )

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

    const hero = heroText(order, t, justPlaced, formatMoney(order.total, language))
    return (
        <main className="flex flex-col gap-6 px-4">
            <StatusHero status={order.status} title={hero.title} hint={hero.hint} />

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

            {order.courierName && !isFinalStatus(order.status) ? (
                <p className="flex items-center gap-2 rounded-control bg-brand/10 px-4 py-3 font-medium">
                    <ScooterIcon size={20} className="text-brand" />
                    {fill(t.order.courier, { name: order.courierName })}
                </p>
            ) : null}

            <Section title={t.order.items}>
                <OrderItems order={order} />
            </Section>
            <Section title={t.order.address}>
                <Address order={order} />
            </Section>
            <Payment order={order} onChange={setOrder} />

            <OrderActions order={order} onChange={setOrder} onStale={reload} />
            <BottomSpacer />
        </main>
    )
}

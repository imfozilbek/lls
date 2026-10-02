import { OrderStatus, PaymentMethod, PaymentStatus } from "@lls/core"

import { fill, useLanguage, useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { formatMoney } from "../lib/format.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"

import { CardIcon, CashIcon, CopyIcon } from "./icons.js"
import { Button } from "./primitives.js"

import type { Dictionary } from "../i18n/index.js"
import type { OrderDTO } from "@lls/core"

type PayState = keyof Dictionary["pay"]["status"]

/** Delivered and not paid is a debt: the one state the order status alone does not tell. */
export function payStateOf(order: OrderDTO): PayState {
    if (order.status === OrderStatus.DELIVERED && order.payment.status === PaymentStatus.UNPAID) {
        return "debt"
    }
    return order.payment.status
}

/** Settled = nothing left to do with this order's money. */
function toneOf(state: PayState): string {
    if (state === "paid" || state === "refunded") {
        return "text-success"
    }
    if (state === "debt" || state === "refund_due") {
        return "text-tg-destructive"
    }
    return "text-warning"
}

/**
 * "💵 Наличными · Оплачено · у доставщика: Jasur". The courier's name is for the owner only:
 * it tells who holds the cash.
 */
export function PaymentLine({
    order,
    forOwner = false,
    className,
}: {
    order: OrderDTO
    forOwner?: boolean
    className?: string
}): React.JSX.Element | null {
    const t = useT()
    const state = payStateOf(order)
    // A cancelled order nobody paid for has no money story to tell.
    if (order.status === OrderStatus.CANCELLED && state === "unpaid") {
        return null
    }
    const cash = order.payment.method === PaymentMethod.CASH
    const holder =
        forOwner &&
        cash &&
        state === "paid" &&
        order.payment.cashCourierId !== undefined &&
        order.payment.cashCourierId === order.courierId &&
        order.courierName
            ? fill(t.pay.withCourier, { name: order.courierName })
            : null
    return (
        <p className={cn("flex items-center gap-2 text-sm", className)}>
            <span className={toneOf(state)}>
                {cash ? <CashIcon size={18} /> : <CardIcon size={18} />}
            </span>
            <span>
                {cash ? t.pay.cash : t.pay.card}
                <span className="text-tg-hint"> · </span>
                <span className="font-semibold">{t.pay.status[state]}</span>
                {holder ? <span className="text-tg-hint"> · {holder}</span> : null}
            </span>
        </p>
    )
}

/** "1234567812345678" → "1234 5678 1234 5678". */
function groupCard(number: string): string {
    return number.replace(/(\d{4})(?=\d)/g, "$1 ")
}

/** The shop's card, with a copy button: the customer pastes it into their bank app. */
export function CardBlock({
    card,
    total,
}: {
    card: { number: string; holder: string }
    total: number
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const copy = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(card.number)
            haptic.success()
            toast(t.pay.copied, "success")
        } catch {
            haptic.error()
        }
    }
    return (
        <div className="animate-rise rounded-tile bg-tg-secondary p-4">
            <p className="text-sm text-tg-hint">{t.pay.cardTitle}</p>
            <p className="mt-1 text-xl font-bold tracking-wide tabular-nums">
                {groupCard(card.number)}
            </p>
            <p className="font-medium uppercase text-tg-subtitle">{card.holder}</p>
            <Button
                variant="surface"
                className="mt-3 w-full"
                icon={<CopyIcon size={18} />}
                onClick={(): void => void copy()}
            >
                {t.pay.copy}
            </Button>
            <p className="mt-3 text-sm text-tg-subtitle">
                {fill(t.pay.transferNote, { sum: formatMoney(total, language) })}
            </p>
        </div>
    )
}

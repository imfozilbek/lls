import { OrderStatus, PaymentStatus } from "@lls/core"

import { fill, useLanguage, useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { formatMoney } from "../lib/format.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"

import { CardIcon, CopyIcon } from "./icons.js"
import { Button } from "./primitives.js"

import type { OrderDTO } from "@lls/core"

/** Settled = nothing left to do with this order's money. */
function toneOf(status: PaymentStatus): string {
    if (status === PaymentStatus.PAID || status === PaymentStatus.REFUNDED) {
        return "text-success"
    }
    if (status === PaymentStatus.REFUND_DUE) {
        return "text-tg-destructive"
    }
    return "text-warning"
}

/**
 * "Перевод на карту · Ждём перевод". The owner reads «Клиент перевёл» where the customer reads
 * «Магазин проверяет перевод».
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
    const status = order.payment.status
    // A cancelled order nobody paid for has no money story to tell.
    if (order.status === OrderStatus.CANCELLED && status === PaymentStatus.UNPAID) {
        return null
    }
    const label =
        forOwner && status === PaymentStatus.AWAITING ? t.pay.ownerAwaiting : t.pay.status[status]
    return (
        <p className={cn("flex items-center gap-2 text-sm", className)}>
            <span className={toneOf(status)}>
                <CardIcon size={18} />
            </span>
            <span>
                {t.pay.card}
                <span className="text-tg-hint"> · </span>
                <span className="font-semibold">{label}</span>
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

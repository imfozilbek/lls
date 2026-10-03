import { OrderStatus, PaymentStatus } from "@zumda/core"

import { fill, useLanguage, useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { formatMoney } from "../lib/format.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"

import { CardIcon, CopyIcon, ShieldIcon } from "./icons.js"
import { Button } from "./primitives.js"

import type { OrderDTO } from "@zumda/core"

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
    shopName,
}: {
    card: { number: string; holder: string }
    total: number
    /** Whose card this is: the shop's name next to a person's, so it never looks like a stranger. */
    shopName?: string
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    /** The bank app wants both: the card number and the exact sum, digits only. */
    const copy = async (text: string, done: string, shown: string): Promise<void> => {
        try {
            await navigator.clipboard.writeText(text)
            haptic.success()
            toast(done, "success")
        } catch {
            // No clipboard here: the value in a toast, to copy by hand.
            haptic.error()
            toast(shown)
        }
    }
    return (
        <div className="animate-rise rounded-tile bg-tg-secondary p-4">
            <p className="text-sm text-tg-hint">{t.pay.cardTitle}</p>
            <p className="mt-1 text-xl font-bold tracking-wide tabular-nums">
                {groupCard(card.number)}
            </p>
            <p className="font-medium uppercase text-tg-subtitle">{card.holder}</p>
            {shopName ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                    <ShieldIcon size={16} className="shrink-0 text-success" />
                    {fill(t.pay.cardOwner, { shop: shopName })}
                </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                    variant="surface"
                    icon={<CopyIcon size={18} />}
                    aria-label={t.pay.copy}
                    onClick={(): void =>
                        void copy(card.number, t.pay.copied, groupCard(card.number))
                    }
                >
                    {t.pay.copyShort}
                </Button>
                <Button
                    variant="surface"
                    icon={<CopyIcon size={18} />}
                    aria-label={t.pay.copySum}
                    onClick={(): void =>
                        void copy(String(total), t.pay.sumCopied, formatMoney(total, language))
                    }
                >
                    {t.pay.copySumShort}
                </Button>
            </div>
            <p className="mt-3 text-sm text-tg-subtitle">
                {fill(t.pay.transferNote, { sum: formatMoney(total, language) })}
            </p>
        </div>
    )
}

import { OrderStatus, PaymentStatus, cardSystemOf } from "@zumda/core"
import { useState } from "react"

import { fill, useLanguage, useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { formatMoney } from "../lib/format.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"

import { AlertIcon, CardIcon, CashIcon, CopyIcon, ShieldIcon } from "./icons.js"
import { PayAppsSheet, groupCard } from "./pay-apps-sheet.js"
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
 * A cash order: paid at the door. The owner also sees where the money is now: with the courier
 * until «Pulni oldim», then in the shop.
 */
function cashLine(
    order: OrderDTO,
    forOwner: boolean,
    t: ReturnType<typeof useT>,
): {
    label: string
    tone: string
} {
    const s = t.pay.cashStatus
    if (order.payment.status !== PaymentStatus.PAID) {
        return { label: s.unpaid, tone: "text-tg-hint" }
    }
    if (!forOwner) {
        return { label: s.paid, tone: "text-success" }
    }
    return order.payment.withCourier
        ? { label: s.withCourier, tone: "text-warning" }
        : { label: s.received, tone: "text-success" }
}

/**
 * "Kartaga o'tkazma · O'tkazma kutilmoqda", "Naqd · Pul kuryerda". The owner reads «Клиент перевёл» where the customer reads
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
    const language = useLanguage()
    const status = order.payment.status
    // A cancelled order nobody paid for has no money story to tell.
    if (order.status === OrderStatus.CANCELLED && status === PaymentStatus.UNPAID) {
        return null
    }
    const cash = order.payment.method === "cash"
    const { label, tone } = cash
        ? cashLine(order, forOwner, t)
        : {
              label:
                  forOwner && status === PaymentStatus.AWAITING
                      ? t.pay.ownerAwaiting
                      : t.pay.status[status],
              tone: toneOf(status),
          }
    // Paid for lines the shop did not have («Yo'q»): the customer sees it is coming back. The
    // owner's card has its own «… qaytarish kerak» with «Qaytardim».
    const owed = forOwner || status !== PaymentStatus.PAID ? undefined : order.payment.refundOwed
    return (
        <p className={cn("flex items-center gap-2 text-sm", className)}>
            <span className={tone}>{cash ? <CashIcon size={18} /> : <CardIcon size={18} />}</span>
            <span>
                {cash ? t.pay.cash : t.pay.card}
                <span className="text-tg-hint"> · </span>
                <span className="font-semibold">{label}</span>
                {owed ? (
                    <span className="block font-semibold text-tg-text">
                        {fill(t.pay.owedBack, { sum: formatMoney(owed, language) })}
                    </span>
                ) : null}
            </span>
        </p>
    )
}

/**
 * The shop's card with «Raqamni nusxalash»: the number goes to the clipboard and the bank apps
 * open in a sheet with the sum to type (owner's decision, November 2026). A demo card only copies:
 * nobody transfers to it.
 */
export function CardBlock({
    card,
    total,
    shopName,
    again = false,
    demo = false,
}: {
    card: { number: string; holder: string }
    total: number
    /** Whose card this is: the shop's name next to a person's, so it never looks like a stranger. */
    shopName?: string
    /** The shop did not see the money: check it and send the screenshot again. */
    again?: boolean
    /** A demo shop («Namuna»): its card is a test card, nobody transfers to it. */
    demo?: boolean
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const system = cardSystemOf(card.number)
    /** The sheet of bank apps; `copied: false` when the phone gave no clipboard. */
    const [apps, setApps] = useState<{ copied: boolean } | null>(null)
    const copy = async (): Promise<void> => {
        let copied = true
        try {
            await navigator.clipboard.writeText(card.number)
            haptic.success()
        } catch {
            copied = false
            haptic.error()
        }
        if (!demo) {
            setApps({ copied })
        } else if (copied) {
            toast(t.pay.copied, "success")
        } else {
            // No clipboard here: the number in a toast, to copy by hand.
            toast(groupCard(card.number))
        }
    }
    return (
        <div className="animate-rise rounded-tile bg-tg-secondary p-4">
            <p className="text-sm text-tg-hint">
                {t.pay.cardTitle}
                {system ? (
                    <>
                        {" · "}
                        <span className="font-semibold text-tg-subtitle">
                            {t.pay.cardSystems[system]}
                        </span>
                    </>
                ) : null}
            </p>
            <p className="mt-1 text-xl font-bold tracking-wide tabular-nums">
                {groupCard(card.number)}
            </p>
            <p className="font-medium uppercase text-tg-subtitle">{card.holder}</p>
            {demo ? (
                <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-tg-destructive">
                    <AlertIcon size={16} className="mt-0.5 shrink-0" />
                    {t.pay.demoCard}
                </p>
            ) : shopName ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                    <ShieldIcon size={16} className="shrink-0 text-success" />
                    {fill(t.pay.cardOwner, { shop: shopName })}
                </p>
            ) : null}
            <Button
                variant="surface"
                className="mt-3 w-full"
                icon={<CopyIcon size={18} />}
                onClick={(): void => void copy()}
            >
                {t.pay.copy}
            </Button>
            <p className="mt-3 text-sm text-tg-subtitle">
                {fill(again ? t.pay.transferNoteAgain : t.pay.transferNote, {
                    sum: formatMoney(total, language),
                })}
            </p>
            {apps ? (
                <PayAppsSheet
                    card={card.number}
                    total={total}
                    copied={apps.copied}
                    onClose={(): void => setApps(null)}
                />
            ) : null}
        </div>
    )
}

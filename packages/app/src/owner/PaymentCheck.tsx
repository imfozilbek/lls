import { PaymentStatus } from "@zumda/core"
import { useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { formatMoney } from "../lib/format.js"
import { confirm, haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { AlertIcon, CardIcon } from "../ui/icons.js"
import { Button } from "../ui/primitives.js"
import { ReceiptThumb } from "../ui/receipt.js"
import { Sheet } from "../ui/sheet.js"

import type { Dictionary } from "../i18n/index.js"
import type { OrderDTO } from "@zumda/core"

/** What should make the owner look twice: a screenshot seen before, transfers never found. */
export function paymentWarnings(order: OrderDTO, t: Dictionary): string[] {
    const c = t.owner.check
    const receipt = order.payment.receipt
    const lines: string[] = []
    if (order.payment.status === PaymentStatus.UNPAID) {
        lines.push(c.noReceipt)
    }
    if (receipt?.reusedFrom !== undefined) {
        lines.push(
            receipt.reusedFrom > 0
                ? fill(c.reusedHere, { n: receipt.reusedFrom })
                : c.reusedElsewhere,
        )
    }
    const rejected = (receipt?.customerRejections ?? 0) + order.payment.rejections
    if (rejected > 0) {
        lines.push(fill(c.rejectedBefore, { count: rejected }))
    }
    return lines
}

/**
 * «Pul keldi» never accepts in one tap: the owner sees the sum, the card it should be on, the
 * screenshot and any warning, opens the bank app, and only then answers yes or no.
 */
export function PaymentCheckSheet({
    order,
    onChange,
    onStale,
    onClose,
}: {
    order: OrderDTO
    onChange(order: OrderDTO): void
    onStale(): void
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const c = t.owner.check
    const [busy, setBusy] = useState<"yes" | "no" | null>(null)
    const sum = formatMoney(order.total, language)
    const card = order.payment.card?.number
    const warnings = paymentWarnings(order, t)

    const answer = async (kind: "yes" | "no"): Promise<void> => {
        // «Pul kelmadi» sends the customer back to the worst moment: one more question first.
        const options = { yes: c.no, destructive: true }
        if (kind === "no" && !(await confirm(c.noConfirm, options))) {
            return
        }
        setBusy(kind)
        try {
            onChange(
                kind === "yes"
                    ? await api.owner.confirmPayment(order.id)
                    : await api.owner.rejectTransfer(order.id),
            )
            haptic.success()
            if (kind === "no") {
                toast(c.rejected)
            }
            onClose()
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
            onStale()
            onClose()
        } finally {
            setBusy(null)
        }
    }

    return (
        <Sheet title={fill(c.title, { sum })} onClose={onClose}>
            <div className="flex flex-col gap-3">
                <div className="min-w-0">
                    {card ? (
                        <p className="flex items-center gap-2 font-semibold">
                            <CardIcon size={18} className="shrink-0 text-brand" />
                            {fill(c.toCard, { card: `•••• ${card.slice(-4)}` })}
                        </p>
                    ) : null}
                    <p className="truncate text-sm font-medium">{order.customerName}</p>
                    <p className="mt-1 text-sm text-tg-subtitle">{c.hint}</p>
                </div>
                {/* The sum and the card digits readable right here, next to the yes and no. */}
                <ReceiptThumb orderId={order.id} sentAt={order.payment.receipt?.at} large />
            </div>
            {warnings.length > 0 ? (
                <ul className="flex flex-col gap-1.5 rounded-control bg-warning/15 px-3 py-2.5">
                    {warnings.map((line) => (
                        <li key={line} className="flex gap-2 text-sm font-medium">
                            <AlertIcon size={18} className="mt-px shrink-0 text-warning" />
                            {line}
                        </li>
                    ))}
                </ul>
            ) : null}
            <Button
                size="lg"
                className="mt-1"
                loading={busy === "yes"}
                disabled={busy !== null}
                onClick={(): void => void answer("yes")}
            >
                {fill(c.yes, { sum })}
            </Button>
            {order.payment.status === PaymentStatus.AWAITING ? (
                <Button
                    variant="danger"
                    loading={busy === "no"}
                    disabled={busy !== null}
                    onClick={(): void => void answer("no")}
                >
                    {c.no}
                </Button>
            ) : null}
        </Sheet>
    )
}

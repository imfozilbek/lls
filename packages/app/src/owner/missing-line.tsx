import { OrderStatus, PaymentMethod, PaymentStatus } from "@zumda/core"
import { useState } from "react"

import { fill, useLanguage, useT } from "../i18n/index.js"
import { api } from "../lib/api.js"
import { formatMoney, quantityMark } from "../lib/format.js"
import { confirm, haptic } from "../lib/telegram.js"
import { Button, Switch } from "../ui/primitives.js"
import { Sheet } from "../ui/sheet.js"

import type { OrderDTO, OrderItemDTO } from "@zumda/core"

/** The card's action: runs a request, shows the order it returns or why it failed. */
type Act = (request: () => Promise<OrderDTO>) => Promise<void>

/**
 * «Yo'q» until «Tayyor» (owner's decision, November 2026): in the queue or while it is collected,
 * and never the last line (cancel the order instead).
 */
export function canTakeOut(order: OrderDTO): boolean {
    const collecting =
        order.status === OrderStatus.ACCEPTED || order.status === OrderStatus.PREPARING
    return collecting && order.items.length > 1
}

/** The paid transfer the shop gives the difference back from. */
function paidTransfer(order: OrderDTO): boolean {
    return (
        order.payment.method === PaymentMethod.CARD_TRANSFER &&
        order.payment.status === PaymentStatus.PAID
    )
}

/**
 * «Mahsulot qolmaganmi?»: the line, the new sum and the money owed back, «Bugun sotuvdan olib
 * qo'yish» (on), then «Buyurtmadan olib tashlash». With a bottle deposit the server works the new
 * sum out (the deposit may change too), so the sheet does not guess it.
 */
export function MissingLineSheet({
    order,
    item,
    act,
    onClose,
}: {
    order: OrderDTO
    item: OrderItemDTO
    act: Act
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    const m = t.owner.missing
    const language = useLanguage()
    const [stop, setStop] = useState(true)
    const [busy, setBusy] = useState(false)
    const exact = order.depositTotal === 0
    const money = (sum: number): string => formatMoney(sum, language)
    const remove = async (): Promise<void> => {
        setBusy(true)
        await act(() => api.owner.removeLine(order.id, item.line, stop))
        setBusy(false)
        onClose()
    }
    return (
        <Sheet
            title={m.title}
            onClose={onClose}
            footer={
                <Button
                    variant="danger"
                    size="lg"
                    className="w-full"
                    loading={busy}
                    onClick={(): void => void remove()}
                >
                    {m.remove}
                </Button>
            }
        >
            <p className="px-1 text-lg font-semibold">
                <span className="tabular-nums text-tg-hint">
                    {quantityMark(item.quantity, item.unit, t.units)}
                </span>{" "}
                {item.name}
                {item.options ? (
                    <span className="block text-sm font-normal text-tg-subtitle">
                        {item.options.label}
                    </span>
                ) : null}
            </p>
            {exact ? (
                <p className="px-1 tabular-nums">
                    {fill(m.sum, { old: money(order.total), new: money(order.total - item.total) })}
                </p>
            ) : null}
            {exact && paidTransfer(order) ? (
                <p className="px-1 text-sm text-tg-subtitle">
                    {fill(m.refund, { sum: money(item.total) })}
                </p>
            ) : null}
            <div className="mt-1 flex items-center justify-between gap-3 rounded-control bg-tg-secondary px-4 py-2.5">
                <span className="font-medium">{m.stopToday}</span>
                <Switch checked={stop} onChange={setStop} label={m.stopToday} />
            </div>
        </Sheet>
    )
}

/** The small «Yo'q» at the end of a line. */
export function MissingButton({
    item,
    onPress,
}: {
    item: OrderItemDTO
    onPress(): void
}): React.JSX.Element {
    const m = useT().owner.missing
    return (
        <button
            type="button"
            aria-label={fill(m.buttonLabel, { name: item.name })}
            onClick={(): void => {
                haptic.tap()
                onPress()
            }}
            className="tap -my-2 min-h-11 shrink-0 rounded-control px-2 text-sm font-semibold text-tg-subtitle focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
            {m.button}
        </button>
    )
}

/** The lines the shop did not have, struck through: the owner still sees what was missing. */
export function RemovedLines({ order }: { order: OrderDTO }): React.JSX.Element | null {
    const t = useT()
    if (!order.removedItems?.length) {
        return null
    }
    return (
        <ul className="mt-0.5 flex flex-col gap-0.5 text-tg-hint">
            {order.removedItems.map((item) => (
                <li key={item.line} className="flex gap-2">
                    <span className="shrink-0 tabular-nums line-through">
                        {quantityMark(item.quantity, item.unit, t.units)}
                    </span>
                    <span className="flex-1">
                        <span className="line-through">{item.name}</span>{" "}
                        <span className="text-sm">({t.owner.missing.was})</span>
                    </span>
                </li>
            ))}
        </ul>
    )
}

/**
 * «{sum} qaytarish kerak» with «Qaytardim», asked once more: a mis-tap would drop money the
 * customer is owed. A cancelled order's whole refund stays in «Pul».
 */
export function RefundOwed({
    order,
    act,
}: {
    order: OrderDTO
    act: Act
}): React.JSX.Element | null {
    const t = useT()
    const language = useLanguage()
    const owed = order.payment.refundOwed
    if (!owed || order.status === OrderStatus.CANCELLED) {
        return null
    }
    const sum = formatMoney(owed, language)
    const refund = async (): Promise<void> => {
        const text = fill(t.owner.money.refundConfirm, { n: order.number, sum })
        if (await confirm(text, { yes: t.owner.money.refunded, destructive: true })) {
            await act(() => api.owner.markRefunded(order.id))
        }
    }
    return (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-control bg-warning/15 px-3 py-2">
            <span className="text-sm font-semibold">{fill(t.owner.missing.owed, { sum })}</span>
            <Button variant="surface" onClick={(): void => void refund()}>
                {t.owner.money.refunded}
            </Button>
        </div>
    )
}

import {
    OrderChannel,
    OrderStatus,
    PaidWith,
    PaymentStatus,
    formatPhone,
    isFinalStatus,
} from "@lls/core"
import { useEffect, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { formatMoney, formatQuantity, formatTime } from "../lib/format.js"
import { usePagedList } from "../lib/paged.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { AddressBlock, ContactLinks } from "../ui/contact-links.js"
import { ReceiptIcon, ScooterIcon, WifiOffIcon } from "../ui/icons.js"
import { LoadMore } from "../ui/load-more.js"
import { StatusBadge } from "../ui/order-status.js"
import { PaymentLine } from "../ui/payment.js"
import { Button, EmptyState, Field, Segmented, Skeleton, TextInput } from "../ui/primitives.js"
import { Sheet, SheetOption } from "../ui/sheet.js"
import { BottomSpacer } from "../ui/shell.js"

import { useOwner } from "./store.js"

import type { Dictionary } from "../i18n/index.js"
import type { PagedList } from "../lib/paged.js"
import type { OrderDTO } from "@lls/core"

type Filter = "active" | "done"

/** New orders also arrive as bot messages; the list refreshes calmly while it is open. */
const POLL_MS = 20_000

interface CardProps {
    order: OrderDTO
    onChange(order: OrderDTO): void
    /** The order moved elsewhere (e.g. from the bot chat): refresh the list. */
    onStale(): void
}

const ASSIGNABLE: readonly string[] = [
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
]

function failToast(t: Dictionary, caught: unknown): void {
    haptic.error()
    toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
}

/** Pick one of the shop's couriers on shift today. Couriers are invited in Settings. */
function CourierSheet({
    order,
    onChange,
    onStale,
    onClose,
}: CardProps & { onClose(): void }): React.JSX.Element {
    const t = useT()
    const couriers = useOwner((state) => state.couriers)
    const loadCouriers = useOwner((state) => state.loadCouriers)
    // Available ones first; the rest stay visible, greyed, with the reason.
    const active = couriers
        ?.filter((courier) => courier.isActive)
        .sort((a, b) => Number(a.unavailableReason !== null) - Number(b.unavailableReason !== null))
    useEffect(() => {
        loadCouriers().catch(() => undefined)
    }, [loadCouriers])

    const assign = async (courierId: string | "network"): Promise<void> => {
        onClose()
        try {
            onChange(
                courierId === "network"
                    ? await api.owner.toNetwork(order.id)
                    : await api.owner.assignCourier(order.id, courierId),
            )
            haptic.success()
        } catch (caught) {
            failToast(t, caught)
            onStale()
        }
    }

    return (
        <Sheet title={t.owner.assign} onClose={onClose}>
            {couriers === null ? <Skeleton className="h-[52px]" /> : null}
            {active?.length === 0 ? <p className="text-tg-hint">{t.owner.noCouriers}</p> : null}
            {active?.map((courier) => (
                <SheetOption
                    key={courier.id}
                    label={courier.name}
                    hint={
                        courier.unavailableReason
                            ? t.owner.courierReasons[courier.unavailableReason]
                            : courier.phone
                              ? formatPhone(courier.phone)
                              : undefined
                    }
                    disabled={courier.unavailableReason !== null}
                    onClick={(): void => void assign(courier.id)}
                />
            ))}
            {order.waitingForNetwork || order.courierId ? null : (
                <SheetOption
                    label={t.owner.toNetwork}
                    hint={t.owner.toNetworkHint}
                    onClick={(): void => void assign("network")}
                />
            )}
        </Sheet>
    )
}

/** Cancel with an optional reason: the customer sees it. */
function CancelSheet({
    order,
    onChange,
    onStale,
    onClose,
}: CardProps & { onClose(): void }): React.JSX.Element {
    const t = useT()
    const [reason, setReason] = useState("")
    const [busy, setBusy] = useState(false)
    const cancel = async (): Promise<void> => {
        setBusy(true)
        try {
            onChange(
                await api.owner.setStatus(order.id, OrderStatus.CANCELLED, {
                    reason: reason.trim() || undefined,
                }),
            )
            haptic.success()
            onClose()
        } catch (caught) {
            failToast(t, caught)
            onStale()
            onClose()
        } finally {
            setBusy(false)
        }
    }
    return (
        <Sheet title={t.owner.cancelConfirm} onClose={onClose}>
            <Field label={t.owner.cancelReason} htmlFor="cancel-reason">
                <TextInput
                    id="cancel-reason"
                    value={reason}
                    maxLength={200}
                    placeholder={t.owner.cancelReasonPlaceholder}
                    onChange={(e): void => setReason(e.target.value)}
                />
            </Field>
            <Button variant="danger" size="lg" loading={busy} onClick={(): void => void cancel()}>
                {t.owner.cancelOrder}
            </Button>
        </Sheet>
    )
}

/** Delivered: how the customer paid at the door decides where the money stands. */
function PaidWithSheet({
    onPick,
    onClose,
}: {
    onPick(paidWith: PaidWith): void
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    const options = [
        { value: PaidWith.CASH, label: t.owner.paidCash },
        { value: PaidWith.CARD_TRANSFER, label: t.owner.paidCard },
        { value: PaidWith.LATER, label: t.owner.paidLater },
    ]
    return (
        <Sheet title={t.owner.howPaid} onClose={onClose}>
            {options.map((option) => (
                <SheetOption
                    key={option.value}
                    label={option.label}
                    onClick={(): void => {
                        onClose()
                        onPick(option.value)
                    }}
                />
            ))}
        </Sheet>
    )
}

function OrderActions(props: CardProps): React.JSX.Element | null {
    const { order, onChange, onStale } = props
    const t = useT()
    const [busy, setBusy] = useState(false)
    const [sheet, setSheet] = useState<"courier" | "cancel" | "paid" | null>(null)
    if (isFinalStatus(order.status)) {
        return null
    }

    const advance = async (status: OrderStatus, paidWith?: PaidWith): Promise<void> => {
        if (
            status === OrderStatus.DELIVERED &&
            !paidWith &&
            order.payment.status !== PaymentStatus.PAID
        ) {
            setSheet("paid")
            return
        }
        setBusy(true)
        try {
            onChange(await api.owner.setStatus(order.id, status, { paidWith }))
            haptic.success()
        } catch (caught) {
            failToast(t, caught)
            onStale()
        } finally {
            setBusy(false)
        }
    }

    const next = order.nextStatus
    const actions = t.owner.actions as Record<string, string>
    const close = (): void => setSheet(null)
    return (
        <div className="mt-4 flex flex-col gap-2">
            {next ? (
                <Button loading={busy} onClick={(): void => void advance(next)}>
                    {actions[next] ?? next}
                </Button>
            ) : null}
            {/* Side by side when both fit; each on its own row in longer languages. */}
            <div className="flex flex-wrap gap-2">
                {ASSIGNABLE.includes(order.status) ? (
                    <Button
                        variant="surface"
                        className="grow whitespace-nowrap"
                        icon={<ScooterIcon size={18} />}
                        onClick={(): void => setSheet("courier")}
                    >
                        {order.courierName ? t.owner.reassign : t.owner.assign}
                    </Button>
                ) : null}
                <Button
                    variant="danger"
                    className="grow whitespace-nowrap"
                    onClick={(): void => setSheet("cancel")}
                >
                    {t.owner.cancelOrder}
                </Button>
            </div>
            {sheet === "courier" ? <CourierSheet {...props} onClose={close} /> : null}
            {sheet === "cancel" ? <CancelSheet {...props} onClose={close} /> : null}
            {sheet === "paid" ? (
                <PaidWithSheet
                    onClose={close}
                    onPick={(paidWith): void => void advance(OrderStatus.DELIVERED, paidWith)}
                />
            ) : null}
        </div>
    )
}

/** Who brings it: the shop's courier, a network courier, or the network is still looking. */
function CourierLine({ order }: { order: OrderDTO }): React.JSX.Element | null {
    const t = useT()
    if (order.waitingForNetwork) {
        return (
            <p className="flex items-center gap-2 px-1 font-medium text-tg-subtitle">
                <ScooterIcon size={18} className="animate-pulse text-brand" />
                {t.owner.networkSearching}
            </p>
        )
    }
    if (!order.courierName) {
        return null
    }
    return (
        <p className="flex flex-wrap items-center gap-2 px-1 font-medium">
            <ScooterIcon size={18} className="text-brand" />
            {t.owner.courier}: {order.courierName}
            {order.viaNetwork ? (
                <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold">
                    {t.owner.viaNetwork}
                </span>
            ) : null}
        </p>
    )
}

function OrderCard({ order, onChange, onStale }: CardProps): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    return (
        <li className="animate-rise rounded-tile bg-tg-secondary p-4">
            <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-bold">
                    {fill(t.order.title, { n: order.number })}
                </span>
                <StatusBadge status={order.status} />
            </div>
            <p className="text-sm text-tg-hint">
                {formatTime(order.createdAt, language)} · {order.customerName}
            </p>
            <ul className="mt-3 flex flex-col gap-1">
                {order.items.map((item) => (
                    <li key={item.productId} className="flex gap-2">
                        <span className="shrink-0 font-semibold tabular-nums">
                            {formatQuantity(item.quantity, item.unit, t.units.kg)}×
                        </span>
                        <span className="flex-1">{item.name}</span>
                    </li>
                ))}
            </ul>
            <p className="mt-2 flex justify-between font-semibold">
                <span>{t.cart.total}</span>
                <span className="tabular-nums">{formatMoney(order.total, language)}</span>
            </p>
            <PaymentLine order={order} forOwner className="mt-1" />
            {order.bottlesReturned > 0 ? (
                <p className="text-sm text-tg-subtitle">
                    {fill(t.owner.bottlesBack, { n: order.bottlesReturned })}
                </p>
            ) : null}
            {order.channel === OrderChannel.MARKETPLACE ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-tg-subtitle">
                    <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-bold text-tg-text">
                        LLS
                    </span>
                    {fill(t.owner.showcaseOrder, { sum: formatMoney(order.commission, language) })}
                </p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2 text-sm">
                <AddressBlock order={order} />
                <CourierLine order={order} />
                <ContactLinks order={order} />
            </div>
            <OrderActions order={order} onChange={onChange} onStale={onStale} />
        </li>
    )
}

/** Orders of one filter; the active list refreshes calmly while it is on screen. */
function useShopOrders(filter: Filter): PagedList<OrderDTO> {
    const list = usePagedList(filter, (page) => api.owner.orders(filter, page))
    const { reload } = list
    useEffect(() => {
        if (filter !== "active") {
            return undefined
        }
        const timer = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void reload()
            }
        }, POLL_MS)
        return (): void => window.clearInterval(timer)
    }, [filter, reload])
    return list
}

export function OrdersTab(): React.JSX.Element {
    const t = useT()
    const [filter, setFilter] = useState<Filter>("active")
    const list = useShopOrders(filter)
    const orders = list.items
    const replace = (order: OrderDTO): void =>
        list.update((items) => items.map((o) => (o.id === order.id ? order : o)))
    const refresh = (): void => void list.reload()

    let body: React.JSX.Element
    if (list.error && orders === null) {
        body = (
            <EmptyState
                art={<WifiOffIcon size={44} />}
                title={errorText(t, list.error)}
                action={
                    <Button variant="secondary" onClick={refresh}>
                        {t.common.retry}
                    </Button>
                }
            />
        )
    } else if (orders === null) {
        body = (
            <div className="flex flex-col gap-3">
                {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-64 rounded-tile" />
                ))}
            </div>
        )
    } else if (orders.length === 0) {
        body = (
            <EmptyState
                art={<ReceiptIcon size={44} />}
                title={filter === "active" ? t.owner.noActive : t.owner.noDone}
                text={filter === "active" ? t.owner.noActiveText : undefined}
            />
        )
    } else {
        body = (
            <div>
                <ul className="flex flex-col gap-3">
                    {orders.map((order) => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            onChange={replace}
                            onStale={refresh}
                        />
                    ))}
                </ul>
                <LoadMore list={list} />
            </div>
        )
    }

    return (
        <section className="flex flex-col gap-4 px-4 pt-2">
            <Segmented<Filter>
                value={filter}
                onChange={setFilter}
                options={[
                    { value: "active", label: t.owner.active },
                    { value: "done", label: t.owner.done },
                ]}
            />
            {body}
            <BottomSpacer />
        </section>
    )
}

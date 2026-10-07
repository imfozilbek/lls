import {
    DEFAULT_NETWORK_WAIT_MINUTES,
    OrderChannel,
    OrderStatus,
    PaymentStatus,
    formatPhone,
    isFinalStatus,
} from "@zumda/core"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { ZUMDA_NAME } from "../lib/brand.js"
import { cn } from "../lib/cn.js"
import { formatMoney, formatQuantity, formatTime } from "../lib/format.js"
import { usePagedList } from "../lib/paged.js"
import { usePolling } from "../lib/polling.js"
import { useRefresh } from "../lib/refresh.js"
import { haptic } from "../lib/telegram.js"
import { useCachedState } from "../lib/use-cached.js"
import { useRingOnNews } from "../lib/use-ring.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { CompactAddress } from "../ui/contact-links.js"
import {
    AlertIcon,
    CardIcon,
    ChevronIcon,
    ClockIcon,
    CloseIcon,
    ReceiptIcon,
    ScooterIcon,
    WifiOffIcon,
} from "../ui/icons.js"
import { LoadMore } from "../ui/load-more.js"
import { OrderBadge } from "../ui/order-status.js"
import { PaymentLine } from "../ui/payment.js"
import { Button, EmptyState, Field, Segmented, Skeleton, TextInput } from "../ui/primitives.js"
import { Sheet, SheetOption } from "../ui/sheet.js"
import { BottomSpacer } from "../ui/shell.js"
import { ZumdaMark } from "../ui/zumda-mark.js"

import { PaymentCheckSheet } from "./PaymentCheck.js"
import { useOwner } from "./store.js"
import { TripScope, TripSlot } from "./trips.js"

import type { Dictionary } from "../i18n/index.js"
import type { PagedList } from "../lib/paged.js"
import type { OrderDTO } from "@zumda/core"

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

    const replaceCourier = useOwner((state) => state.replaceCourier)
    const assign = async (courierId: string | "network", backToday = false): Promise<void> => {
        onClose()
        try {
            if (backToday && courierId !== "network") {
                // Switched off for today, maybe by mistake: picking them is the owner's yes.
                replaceCourier(await api.owner.setCourierSchedule(courierId, { offToday: false }))
            }
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
            {active?.map((courier) => {
                // «Bugun ishlamaydi» is the owner's own switch: one tap turns it back and assigns.
                const offToday = courier.unavailableReason === "off_today" && courier.onShift
                return (
                    <SheetOption
                        key={courier.id}
                        label={courier.name}
                        hint={
                            offToday
                                ? t.owner.backTodayAssign
                                : courier.unavailableReason
                                  ? t.owner.courierReasons[courier.unavailableReason]
                                  : courier.phone
                                    ? formatPhone(courier.phone)
                                    : undefined
                        }
                        disabled={courier.unavailableReason !== null && !offToday}
                        onClick={(): void => void assign(courier.id, offToday)}
                    />
                )
            })}
            {/* A network courier carries no money: a cash order goes only with the shop's own. */}
            {order.waitingForNetwork ||
            order.courierId ||
            order.payment.method === "cash" ? null : (
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

function OrderActions(props: CardProps): React.JSX.Element | null {
    const { order, onChange, onStale } = props
    const t = useT()
    const [busy, setBusy] = useState(false)
    const [sheet, setSheet] = useState<"courier" | "cancel" | "pay" | null>(null)
    if (isFinalStatus(order.status)) {
        return null
    }

    const act = async (request: () => Promise<OrderDTO>): Promise<void> => {
        setBusy(true)
        try {
            onChange(await request())
            haptic.success()
        } catch (caught) {
            failToast(t, caught)
            onStale()
        } finally {
            setBusy(false)
        }
    }

    const next = order.nextStatus
    // A transfer order starts only after the money: accepting is «Деньги пришли, принять».
    // A cash order is accepted at once and paid at the door.
    const waitsForMoney =
        next === OrderStatus.ACCEPTED &&
        order.payment.method !== "cash" &&
        order.payment.status !== PaymentStatus.PAID
    const actions = t.owner.actions as Record<string, string>
    const close = (): void => setSheet(null)
    return (
        <div className="mt-3 flex flex-col gap-1">
            {next && waitsForMoney ? (
                // No screenshot yet: possible, but not the main thing to do.
                <Button
                    variant={
                        order.payment.status === PaymentStatus.AWAITING ? "primary" : "surface"
                    }
                    disabled={busy}
                    icon={<CardIcon size={18} />}
                    onClick={(): void => {
                        haptic.tap()
                        setSheet("pay")
                    }}
                >
                    {t.owner.paidAccept}
                </Button>
            ) : null}
            {next && !waitsForMoney ? (
                <Button
                    loading={busy}
                    onClick={(): void => void act(() => api.owner.setStatus(order.id, next))}
                >
                    {actions[next] ?? next}
                </Button>
            ) : null}
            {/* One main step above; the courier and the cancel stay quiet below it. */}
            <div className="flex flex-wrap items-center justify-between gap-x-2">
                {ASSIGNABLE.includes(order.status) ? (
                    <Button
                        variant="ghost"
                        className="-ml-2 whitespace-nowrap px-2"
                        icon={<ScooterIcon size={18} />}
                        disabled={busy}
                        onClick={(): void => setSheet("courier")}
                    >
                        {order.courierName ? t.owner.reassign : t.owner.assign}
                    </Button>
                ) : (
                    <span />
                )}
                <Button
                    variant="quietDanger"
                    className="-mr-2 whitespace-nowrap px-2"
                    disabled={busy}
                    onClick={(): void => setSheet("cancel")}
                >
                    {t.owner.cancelOrder}
                </Button>
            </div>
            {sheet === "courier" ? <CourierSheet {...props} onClose={close} /> : null}
            {sheet === "cancel" ? <CancelSheet {...props} onClose={close} /> : null}
            {sheet === "pay" ? <PaymentCheckSheet {...props} onClose={close} /> : null}
        </div>
    )
}

const MINUTE_MS = 60_000

/**
 * How long the district has looked for a courier. Advice to act only once the usual wait has
 * passed: before that the network simply needs a minute.
 */
function networkWaitText(t: Dictionary, requestedAt: string): string {
    const minutes = Math.floor((Date.now() - Date.parse(requestedAt)) / MINUTE_MS)
    if (minutes < 1) {
        return t.owner.networkJustAsked
    }
    const waited = fill(t.owner.networkWaited, { n: minutes })
    return minutes < DEFAULT_NETWORK_WAIT_MINUTES ? waited : `${waited} ${t.owner.networkLate}`
}

/** Who brings it: the shop's courier, a network courier, or the network is still looking. */
function CourierLine({ order }: { order: OrderDTO }): React.JSX.Element | null {
    const t = useT()
    if (order.waitingForNetwork) {
        return (
            <p className="flex items-start gap-2 px-1 font-medium text-tg-subtitle">
                <ScooterIcon size={18} className="mt-0.5 shrink-0 animate-pulse text-brand" />
                <span className="min-w-0">
                    {t.owner.networkSearching}
                    {order.networkRequestedAt ? (
                        <span className="block text-sm font-normal text-tg-hint">
                            {networkWaitText(t, order.networkRequestedAt)}
                        </span>
                    ) : null}
                </span>
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

/** After this long an open order looks late: the age turns amber. */
const LATE_MINUTES = 30

/** How long an open order has waited: the oldest needs the owner first. */
function OrderAge({ createdAt }: { createdAt: string }): React.JSX.Element {
    const t = useT()
    const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / MINUTE_MS))
    const late = minutes >= LATE_MINUTES
    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center gap-1 font-medium",
                late ? "text-tg-text" : "text-tg-subtitle",
            )}
        >
            {/* Amber only on the icon: amber text would not read on a light card. */}
            <ClockIcon size={14} className={cn("shrink-0", late && "text-warning")} />
            {minutes < 1 ? t.owner.ageNew : fill(t.owner.age, { n: minutes })}
        </span>
    )
}

/** The customer said they transferred: the owner's next move is the bank app. */
function needsCheck(order: OrderDTO): boolean {
    return order.status === OrderStatus.PENDING && order.payment.status === PaymentStatus.AWAITING
}

/** A long order shows its first lines and «+N ta»: a tap shows the rest. */
const SHOWN_ITEMS = 3

function CardItems({ order }: { order: OrderDTO }): React.JSX.Element {
    const t = useT()
    const [all, setAll] = useState(false)
    const hidden = order.items.length - SHOWN_ITEMS
    const shown = all || hidden <= 1 ? order.items : order.items.slice(0, SHOWN_ITEMS)
    return (
        <ul className="mt-2 flex flex-col gap-0.5">
            {shown.map((item) => (
                <li key={item.productId} className="flex gap-2">
                    <span className="shrink-0 font-semibold tabular-nums">
                        {formatQuantity(item.quantity, item.unit, t.units)}×
                    </span>
                    <span className="flex-1">{item.name}</span>
                </li>
            ))}
            {shown.length < order.items.length ? (
                <li>
                    <button
                        type="button"
                        onClick={(): void => {
                            haptic.tap()
                            setAll(true)
                        }}
                        className="tap -ml-1 min-h-11 rounded-control px-1 text-sm font-semibold text-brand"
                    >
                        {fill(t.owner.moreItems, { n: hidden })}
                    </button>
                </li>
            ) : null}
        </ul>
    )
}

function OrderCard({ order, onChange, onStale }: CardProps): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const shopPlace = useSession((state) => state.shop?.location)
    return (
        <li
            className={cn(
                "animate-rise rounded-tile bg-tg-secondary p-4",
                needsCheck(order) && "ring-2 ring-warning/60",
            )}
            data-needs-check={needsCheck(order) || undefined}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <span className="text-lg font-bold">
                        {fill(t.order.title, { n: order.number })}
                    </span>
                    {/* Time, who, and how long it has waited: one line, so the card stays short. */}
                    <p className="flex flex-wrap items-center gap-x-2 text-sm text-tg-hint">
                        <span className="min-w-0 truncate">
                            {formatTime(order.createdAt, language)} · {order.customerName}
                        </span>
                        {isFinalStatus(order.status) ? null : (
                            <OrderAge createdAt={order.createdAt} />
                        )}
                    </p>
                </div>
                <OrderBadge order={order} forOwner />
            </div>
            <CardItems order={order} />
            <p className="mt-1.5 flex justify-between font-semibold">
                <span>{t.cart.total}</span>
                <span className="tabular-nums">{formatMoney(order.total, language)}</span>
            </p>
            {/* Not yet transferred: the badge already says it, once is enough. Cash says so. */}
            {order.status === OrderStatus.PENDING &&
            order.payment.method !== "cash" &&
            order.payment.status === PaymentStatus.UNPAID ? null : (
                <PaymentLine order={order} forOwner className="mt-1" />
            )}
            {order.bottlesReturned > 0 ? (
                <p className="text-sm text-tg-subtitle">
                    {fill(t.owner.bottlesBack, { n: order.bottlesReturned })}
                </p>
            ) : null}
            {order.channel === OrderChannel.MARKETPLACE ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-tg-subtitle">
                    <span className="flex items-center gap-1 rounded-full bg-tg-secondary py-0.5 pl-0.5 pr-2 text-xs font-bold text-tg-text">
                        <ZumdaMark size={16} />
                        {ZUMDA_NAME}
                    </span>
                    {fill(t.owner.showcaseOrder, { sum: formatMoney(order.commission, language) })}
                </p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2 border-t border-tg-separator pt-3 text-sm">
                <CompactAddress order={order} shop={shopPlace} />
                <CourierLine order={order} />
                <TripSlot order={order} />
            </div>
            <OrderActions order={order} onChange={onChange} onStale={onStale} />
        </li>
    )
}

/** The order a bot message opened: first, outlined, until the owner puts it away. */
function FocusedOrder({
    id,
    onChange,
}: {
    id: string
    onChange(order: OrderDTO): void
}): React.JSX.Element | null {
    const t = useT()
    const focusOrder = useOwner((state) => state.focusOrder)
    const [order, setOrder] = useCachedState<OrderDTO>(`owner-order:${id}`)
    useEffect(() => {
        api.order(id)
            .then(setOrder)
            .catch((caught: unknown) => {
                // Say why the order from the message is not here instead of dropping it silently.
                toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
                focusOrder(null)
            })
    }, [id, focusOrder, t, setOrder])
    if (!order) {
        return <Skeleton className="h-64 rounded-tile" />
    }
    const change = (next: OrderDTO): void => {
        setOrder(next)
        onChange(next)
    }
    return (
        <section className="flex flex-col gap-2" aria-label={t.owner.fromMessage}>
            <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-tg-subtitle">{t.owner.fromMessage}</h2>
                <button
                    type="button"
                    onClick={(): void => {
                        haptic.tap()
                        focusOrder(null)
                    }}
                    className="tap flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-tg-hint focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                    <CloseIcon size={16} />
                    {t.owner.hideFocused}
                </button>
            </div>
            <ul className="rounded-tile ring-2 ring-brand">
                <OrderCard
                    order={order}
                    onChange={change}
                    onStale={(): void =>
                        void api
                            .order(id)
                            .then(setOrder)
                            .catch(() => focusOrder(null))
                    }
                />
            </ul>
        </section>
    )
}

/** Orders of one filter; the active list refreshes calmly while it is on screen. */
function useShopOrders(filter: Filter): PagedList<OrderDTO> {
    const list = usePagedList(filter, (page) => api.owner.orders(filter, page))
    // Every 20 s a one-line question «anything new?»; the list itself only when the answer moved.
    const seen = useRef<string | null>(null)
    const reload = list.reload
    const check = useCallback(async (): Promise<void> => {
        const { version } = await api.owner.ordersVersion()
        if (version !== seen.current) {
            seen.current = version
            await reload()
        }
    }, [reload])
    usePolling(check, POLL_MS, filter === "active")
    useRefresh(list.reload)
    // A new order, or a customer's «O'tkazdim»: the Zumda sound, like a taxi's new ride.
    const snapshot = useMemo(
        () =>
            filter === "active" && list.items
                ? new Map(list.items.map((o) => [o.id, `${o.status}:${o.payment.status}`]))
                : null,
        [filter, list.items],
    )
    useRingOnNews(`owner-orders:${filter}`, snapshot, "order", (state) =>
        state.endsWith(`:${PaymentStatus.AWAITING}`),
    )
    return list
}

/** Transfers to check come first: at rush hour they are what holds a customer back. */
/**
 * Active orders in the order they need the owner: money to check first, then the oldest, which
 * has waited longest. Finished ones stay newest first.
 */
function ownerQueue(
    items: readonly OrderDTO[],
    focusId: string | null,
    active: boolean,
): OrderDTO[] {
    return items
        .filter((order) => order.id !== focusId)
        .sort(
            (a, b) =>
                Number(needsCheck(b)) - Number(needsCheck(a)) ||
                (active ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : 0),
        )
}

function ToCheckBanner({ count }: { count: number }): React.JSX.Element | null {
    const t = useT()
    if (count === 0) {
        return null
    }
    // One tap to the first transfer to check (they come first in the list).
    return (
        <button
            type="button"
            onClick={(): void => {
                haptic.tap()
                document
                    .querySelector("[data-needs-check]")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }}
            className="tap flex animate-rise items-center gap-2 rounded-control bg-warning/15 px-4 py-3 text-left font-semibold"
        >
            <AlertIcon size={20} className="shrink-0 text-warning" />
            <span className="flex-1">{fill(t.owner.toCheck, { n: count })}</span>
            <ChevronIcon size={18} className="shrink-0 text-tg-subtitle" />
        </button>
    )
}

export function OrdersTab(): React.JSX.Element {
    const t = useT()
    const [filter, setFilter] = useState<Filter>("active")
    const focusId = useOwner((state) => state.focusOrderId)
    const list = useShopOrders(filter)
    const orders = list.items ? ownerQueue(list.items, focusId, filter === "active") : null
    const toCheck = orders?.filter(needsCheck).length ?? 0
    const replace = (order: OrderDTO): void =>
        list.update((items) => items.map((o) => (o.id === order.id ? order : o)))
    const update = list.update
    const replaceMany = useCallback(
        (changed: OrderDTO[]): void => {
            const byId = new Map(changed.map((o) => [o.id, o]))
            update((items) => items.map((o) => byId.get(o.id) ?? o))
        },
        [update],
    )
    const shopPlace = useSession((state) => state.shop?.location)
    const refresh = (): void => void list.reload()
    // Orders waiting: «Ishga tayyor» folds into one line so the orders come first.
    const setActiveOrders = useOwner((state) => state.setActiveOrders)
    const activeCount = filter === "active" ? list.items?.length : undefined
    useEffect(() => {
        if (activeCount !== undefined) {
            setActiveOrders(activeCount)
        }
    }, [activeCount, setActiveOrders])

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
            <TripScope
                orders={filter === "active" ? list.items : null}
                shop={shopPlace}
                onChange={replaceMany}
            >
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
            </TripScope>
        )
    }

    return (
        <section className="flex flex-col gap-4 px-4 pt-2">
            {focusId ? <FocusedOrder key={focusId} id={focusId} onChange={replace} /> : null}
            <Segmented<Filter>
                value={filter}
                onChange={setFilter}
                options={[
                    { value: "active", label: t.owner.active },
                    { value: "done", label: t.owner.done },
                ]}
            />
            {filter === "active" ? <ToCheckBanner count={toCheck} /> : null}
            {body}
            <BottomSpacer />
        </section>
    )
}

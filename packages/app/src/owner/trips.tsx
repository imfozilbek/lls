import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { useBackButton, useSuspendMainAction } from "../lib/main-button.js"
import { haptic } from "../lib/telegram.js"
import { isStopDone, sameWayOrders, suggestedOrder, tripOrders } from "../lib/trips.js"
import { toast } from "../stores/toast.js"
import { CheckIcon, ChevronIcon, CloseIcon } from "../ui/icons.js"
import { Button } from "../ui/primitives.js"
import { TripMap, TripWay } from "../ui/trip-map.js"

import { useOwner } from "./store.js"

import type { TripWithOrders } from "../lib/api.js"
import type { Point } from "../lib/map.js"
import type { CourierDTO, OrderDTO, TripDTO } from "@zumda/core"
import type { ReactNode } from "react"

/** The shop's trips still on the way, read again whenever the active orders change. */
export function useShopTrips(orders: readonly OrderDTO[] | null): TripWithOrders[] {
    const [trips, setTrips] = useState<TripWithOrders[]>([])
    const key = useMemo(
        () =>
            orders?.map((o) => `${o.id}:${o.status}:${o.tripId ?? ""}:${o.tripStop ?? ""}`).join(),
        [orders],
    )
    const hasTrips = orders?.some((o) => o.tripId !== undefined) ?? false
    useEffect(() => {
        if (!hasTrips) {
            setTrips([])
            return undefined
        }
        let alive = true
        api.owner
            .trips()
            .then((page) => {
                if (alive) {
                    setTrips(page.data)
                }
            })
            .catch(() => undefined)
        return (): void => {
            alive = false
        }
    }, [key, hasTrips])
    return trips
}

/** A full-screen layer of the owner's: a title, a close button, the content, the action. */
function Layer({
    title,
    onClose,
    footer,
    children,
}: {
    title: string
    onClose(): void
    footer: ReactNode
    children: ReactNode
}): React.JSX.Element {
    const t = useT()
    useBackButton(onClose)
    useSuspendMainAction()
    return createPortal(
        <div
            className="fixed inset-0 z-viewer flex animate-fade-in flex-col bg-tg-bg"
            role="dialog"
            aria-modal
            aria-label={title}
        >
            <header className="flex items-center gap-2 px-4 pb-2 pt-3">
                <h2 className="flex-1 text-lg font-bold">{title}</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t.map.close}
                    className="tap flex h-10 w-10 items-center justify-center rounded-full bg-tg-secondary"
                >
                    <CloseIcon size={20} />
                </button>
            </header>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3">{children}</div>
            <footer className="pb-safe border-t border-tg-separator px-4 pt-3">{footer}</footer>
        </div>,
        document.body,
    )
}

/** One stop in a list: its number, the address, and ↑↓ while its place may still change. */
function StopRow({
    order,
    index,
    count,
    movable,
    onMove,
    lead,
}: {
    order: OrderDTO
    index: number
    count: number
    movable: boolean
    onMove(index: number, by: -1 | 1): void
    lead?: ReactNode
}): React.JSX.Element {
    const t = useT()
    const done = isStopDone(order)
    return (
        <li
            className="flex items-center gap-3 rounded-control bg-tg-secondary p-3"
            data-stop={index + 1}
        >
            {lead}
            <span
                className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                    done ? "bg-tg-hint text-white" : "bg-brand text-brand-ink",
                )}
            >
                {done ? <CheckIcon size={16} strokeWidth={2.5} /> : index + 1}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                    #{order.number} · {order.address}
                </span>
                <span className="block truncate text-sm text-tg-hint">
                    {done ? t.trip.done : order.customerName}
                </span>
            </span>
            {movable ? (
                <span className="flex shrink-0 gap-1">
                    <ArrowButton
                        label={t.trip.up}
                        disabled={index === 0}
                        onClick={(): void => onMove(index, -1)}
                        up
                    />
                    <ArrowButton
                        label={t.trip.down}
                        disabled={index === count - 1}
                        onClick={(): void => onMove(index, 1)}
                    />
                </span>
            ) : null}
        </li>
    )
}

function ArrowButton({
    label,
    disabled,
    onClick,
    up = false,
}: {
    label: string
    disabled: boolean
    onClick(): void
    up?: boolean
}): React.JSX.Element {
    return (
        <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={(): void => {
                haptic.select()
                onClick()
            }}
            className="tap grid h-10 w-10 place-items-center rounded-full bg-tg-bg disabled:opacity-30"
        >
            <ChevronIcon size={18} className={up ? "-rotate-90" : "rotate-90"} />
        </button>
    )
}

/** Moves one item of a list up or down by one place. */
function moved<T>(list: readonly T[], index: number, by: -1 | 1): T[] {
    const next = [...list]
    const [item] = next.splice(index, 1)
    if (item !== undefined) {
        next.splice(index + by, 0, item)
    }
    return next
}

function failToast(t: ReturnType<typeof useT>, caught: unknown): void {
    haptic.error()
    toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
}

/** The shop's couriers who can take orders now; the one already on the order comes first. */
function useFreeCouriers(preferred: string | undefined): CourierDTO[] {
    const couriers = useOwner((state) => state.couriers)
    const loadCouriers = useOwner((state) => state.loadCouriers)
    useEffect(() => {
        loadCouriers().catch(() => undefined)
    }, [loadCouriers])
    return useMemo(
        () =>
            (couriers ?? [])
                .filter((c) => c.isActive && c.unavailableReason === null)
                .sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred)),
        [couriers, preferred],
    )
}

function CourierChips({
    couriers,
    value,
    onChange,
}: {
    couriers: CourierDTO[]
    value: string | null
    onChange(id: string): void
}): React.JSX.Element {
    const t = useT()
    return (
        <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-tg-subtitle">{t.trip.courier}</p>
            {couriers.length === 0 ? <p className="text-tg-hint">{t.owner.noCouriers}</p> : null}
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.trip.courier}>
                {couriers.map((courier) => (
                    <button
                        key={courier.id}
                        type="button"
                        role="radio"
                        aria-checked={value === courier.id}
                        onClick={(): void => {
                            haptic.select()
                            onChange(courier.id)
                        }}
                        className={cn(
                            "tap h-11 rounded-full px-4 font-medium",
                            value === courier.id ? "bg-brand text-brand-ink" : "bg-tg-secondary",
                        )}
                    >
                        {courier.name}
                    </button>
                ))}
            </div>
        </div>
    )
}

/** The checked orders and their order: Zumda's when the choice changes, then the owner's ↑↓. */
function useTripChoice(
    shop: Point,
    all: readonly OrderDTO[],
): {
    stops: OrderDTO[]
    chosen: Set<string>
    toggle(id: string): void
    move(index: number, by: -1 | 1): void
} {
    const [chosen, setChosen] = useState(() => new Set(all.map((o) => o.id)))
    const [sequence, setSequence] = useState(() => suggestedOrder(shop, all).map((o) => o.id))
    const toggle = useCallback(
        (id: string): void => {
            haptic.select()
            setChosen((current) => {
                const next = new Set(current)
                if (!next.delete(id)) {
                    next.add(id)
                }
                const picked = all.filter((o) => next.has(o.id))
                setSequence(suggestedOrder(shop, picked).map((o) => o.id))
                return next
            })
        },
        [all, shop],
    )
    const byId = useMemo(() => new Map(all.map((o) => [o.id, o])), [all])
    const stops = sequence.flatMap((id) => {
        const order = byId.get(id)
        return order && chosen.has(id) ? [order] : []
    })
    const move = (index: number, by: -1 | 1): void =>
        setSequence(
            moved(
                stops.map((o) => o.id),
                index,
                by,
            ),
        )
    return { stops, chosen, toggle, move }
}

/**
 * «Bir yo'nalish»: the order and the others going the same way, checked; Zumda's order of the
 * stops, ↑↓ to change it; one courier; «Tayinlash» gives them all at once.
 */
export function TripSheet({
    order,
    mates,
    shop,
    onDone,
    onClose,
}: {
    order: OrderDTO
    mates: OrderDTO[]
    shop: Point
    onDone(orders: OrderDTO[]): void
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    const all = useMemo(() => [order, ...mates], [order, mates])
    const { stops, chosen, toggle, move } = useTripChoice(shop, all)
    const couriers = useFreeCouriers(order.courierId)
    const [courierId, setCourierId] = useState<string | null>(null)
    const picked = courierId ?? (couriers.length === 1 ? (couriers[0]?.id ?? null) : null)
    const [busy, setBusy] = useState(false)

    const assign = async (): Promise<void> => {
        if (stops.length < 2 || !picked) {
            toast(stops.length < 2 ? t.trip.chooseTwo : t.trip.noCourier, "error")
            return
        }
        setBusy(true)
        try {
            const made = await api.owner.createTrip(
                picked,
                stops.map((o) => o.id),
            )
            haptic.success()
            const name = couriers.find((c) => c.id === picked)?.name ?? ""
            toast(fill(t.trip.assigned, { name }), "success")
            onDone(made.orders)
            onClose()
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setBusy(false)
        }
    }

    return (
        <Layer
            title={t.trip.title}
            onClose={onClose}
            footer={
                <Button
                    size="lg"
                    className="w-full"
                    loading={busy}
                    onClick={(): void => void assign()}
                >
                    {t.trip.assign} · {stops.length}
                </Button>
            }
        >
            <p className="text-sm text-tg-subtitle">{t.trip.hint}</p>
            <TripMap trip={null} shop={shop} stops={stops} />
            <ul className="flex flex-col gap-2" aria-label={t.trip.title}>
                {stops.map((stop, index) => (
                    <StopRow
                        key={stop.id}
                        order={stop}
                        index={index}
                        count={stops.length}
                        movable
                        onMove={move}
                        lead={<Check checked onClick={(): void => toggle(stop.id)} order={stop} />}
                    />
                ))}
                {all
                    .filter((o) => !chosen.has(o.id))
                    .map((o) => (
                        <li key={o.id} className="flex items-center gap-3 rounded-control p-3">
                            <Check checked={false} onClick={(): void => toggle(o.id)} order={o} />
                            <span className="min-w-0 flex-1 truncate text-tg-subtitle">
                                #{o.number} · {o.address}
                            </span>
                        </li>
                    ))}
            </ul>
            <CourierChips couriers={couriers} value={picked} onChange={setCourierId} />
        </Layer>
    )
}

function Check({
    checked,
    onClick,
    order,
}: {
    checked: boolean
    onClick(): void
    order: OrderDTO
}): React.JSX.Element {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={`#${order.number}`}
            onClick={onClick}
            className={cn(
                "tap grid h-7 w-7 shrink-0 place-items-center rounded-md border-2",
                checked ? "border-brand bg-brand text-brand-ink" : "border-tg-hint/50",
            )}
        >
            {checked ? <CheckIcon size={16} strokeWidth={3} /> : null}
        </button>
    )
}

/** The owner's view of a trip on its way: the map, the stops, ↑↓ for those still to go. */
function TripViewer({
    trip,
    orders,
    shop,
    onDone,
    onClose,
}: {
    trip: TripDTO
    orders: readonly OrderDTO[]
    shop: Point | undefined
    onDone(orders: OrderDTO[]): void
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    const [current, setCurrent] = useState(trip)
    const stops = tripOrders(current, orders)
    const done = stops.filter(isStopDone)
    const [left, setLeft] = useState(() => stops.filter((o) => !isStopDone(o)).map((o) => o.id))
    const shown = [...done, ...left.flatMap((id) => stops.filter((o) => o.id === id))]
    const changed =
        left.join() !==
        stops
            .filter((o) => !isStopDone(o))
            .map((o) => o.id)
            .join()
    const [busy, setBusy] = useState(false)
    const save = async (): Promise<void> => {
        setBusy(true)
        try {
            const result = await api.owner.reorderTrip(current.id, left)
            setCurrent(result.trip)
            onDone(result.orders)
            haptic.success()
            toast(t.trip.saved, "success")
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setBusy(false)
        }
    }
    return (
        <Layer
            title={t.trip.open}
            onClose={onClose}
            footer={
                <Button
                    size="lg"
                    className="w-full"
                    variant={changed ? "primary" : "secondary"}
                    disabled={!changed}
                    loading={busy}
                    onClick={(): void => void save()}
                >
                    {t.trip.save}
                </Button>
            }
        >
            <TripMap trip={changed ? null : current} shop={shop} stops={shown} className="h-56" />
            <TripWay trip={current} />
            <ul className="flex flex-col gap-2">
                {shown.map((stop, index) => (
                    <StopRow
                        key={stop.id}
                        order={stop}
                        index={index}
                        count={shown.length}
                        movable={!isStopDone(stop) && left.length > 1}
                        onMove={(i, by): void => setLeft(moved(left, i - done.length, by))}
                    />
                ))}
            </ul>
        </Layer>
    )
}

/**
 * Under an order's courier line: its trip (stop, how many delivered, the map), or, for an order
 * with others going the same way, «Shu yo'nalishda yana N ta».
 */
export function TripLine({
    order,
    orders,
    trips,
    shop,
    onChange,
}: {
    order: OrderDTO
    orders: readonly OrderDTO[]
    trips: readonly TripWithOrders[]
    shop: Point | undefined
    onChange(orders: OrderDTO[]): void
}): React.JSX.Element | null {
    const t = useT()
    const [open, setOpen] = useState(false)
    const found = order.tripId ? trips.find((x) => x.trip.id === order.tripId) : undefined
    const trip = found?.trip
    // The list's copy of an order is the freshest; delivered stops come with the trip.
    const known = useMemo(() => {
        const byId = new Map((found?.orders ?? []).map((o) => [o.id, o]))
        for (const o of orders) {
            byId.set(o.id, o)
        }
        return [...byId.values()]
    }, [found, orders])
    const mates = useMemo(() => sameWayOrders(order, orders, shop), [order, orders, shop])
    if (trip) {
        const stops = tripOrders(trip, known)
        return (
            <>
                <button
                    type="button"
                    onClick={(): void => setOpen(true)}
                    className="tap flex min-h-11 items-center gap-2 rounded-control bg-brand/10 px-3 text-left text-sm font-semibold"
                >
                    <span className="flex-1">
                        {fill(t.trip.line, {
                            n: order.tripStop ?? 1,
                            done: stops.filter(isStopDone).length,
                            total: stops.length,
                        })}
                    </span>
                    <ChevronIcon size={16} className="shrink-0 text-tg-subtitle" />
                </button>
                {open ? (
                    <TripViewer
                        trip={trip}
                        orders={known}
                        shop={shop}
                        onDone={onChange}
                        onClose={(): void => setOpen(false)}
                    />
                ) : null}
            </>
        )
    }
    if (mates.length === 0 || !shop) {
        return null
    }
    return (
        <>
            <button
                type="button"
                onClick={(): void => {
                    haptic.tap()
                    setOpen(true)
                }}
                className="tap flex min-h-11 items-center gap-2 rounded-control bg-brand/10 px-3 text-left text-sm font-semibold text-brand"
            >
                <span className="flex-1">{fill(t.trip.sameWay, { n: mates.length })}</span>
                <ChevronIcon size={16} className="shrink-0" />
            </button>
            {open ? (
                <TripSheet
                    order={order}
                    mates={mates}
                    shop={shop}
                    onDone={onChange}
                    onClose={(): void => setOpen(false)}
                />
            ) : null}
        </>
    )
}

interface TripScopeValue {
    orders: readonly OrderDTO[]
    trips: readonly TripWithOrders[]
    shop: Point | undefined
    onChange(orders: OrderDTO[]): void
}

const TripContext = createContext<TripScopeValue | null>(null)

/** «Buyurtmalar» gives every card the shop's active orders and trips, read once for all. */
export function TripScope({
    orders,
    shop,
    onChange,
    children,
}: {
    orders: readonly OrderDTO[] | null
    shop: Point | undefined
    onChange(orders: OrderDTO[]): void
    children: ReactNode
}): React.JSX.Element {
    const trips = useShopTrips(orders)
    const value = useMemo(
        () => ({ orders: orders ?? [], trips, shop, onChange }),
        [orders, trips, shop, onChange],
    )
    return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}

/** The trip line of one card, inside «Buyurtmalar»'s TripScope (nothing outside it). */
export function TripSlot({ order }: { order: OrderDTO }): React.JSX.Element | null {
    const scope = useContext(TripContext)
    if (!scope) {
        return null
    }
    return (
        <TripLine
            order={order}
            orders={scope.orders}
            trips={scope.trips}
            shop={scope.shop}
            onChange={scope.onChange}
        />
    )
}

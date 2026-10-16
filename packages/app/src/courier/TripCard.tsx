import { OrderStatus } from "@zumda/core"
import { useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"
import { isStopDone, tripOrders, yandexRouteUrl } from "../lib/trips.js"
import { toast } from "../stores/toast.js"
import { CallLink } from "../ui/contact-links.js"
import { CheckIcon, ChevronIcon, PinIcon, ScooterIcon, StoreIcon } from "../ui/icons.js"
import { Button } from "../ui/primitives.js"
import { TripMap, TripWay } from "../ui/trip-map.js"

import type { CourierOrderDTO, OrderDTO, TripDTO } from "@zumda/core"
import type { ReactNode } from "react"

/** Picked up but not yet at the door. */
function onTheWay(order: OrderDTO): boolean {
    return order.status === OrderStatus.PICKED_UP
}

/** «Hammasini oldim»: active only when every order still at the shop is ready. */
function PickUpAll({
    trip,
    stops,
    onChange,
    onStale,
}: {
    trip: TripDTO
    stops: readonly OrderDTO[]
    onChange(orders: OrderDTO[]): void
    onStale(): void
}): React.JSX.Element | null {
    const t = useT()
    const [busy, setBusy] = useState(false)
    const waiting = stops.filter((o) => !isStopDone(o) && !onTheWay(o))
    if (waiting.length === 0) {
        return null
    }
    const ready = waiting.filter((o) => o.status === OrderStatus.READY).length
    const take = async (): Promise<void> => {
        setBusy(true)
        try {
            const result = await api.courier.pickUpTrip(trip.id)
            haptic.success()
            onChange(result.orders)
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
            onStale()
        } finally {
            setBusy(false)
        }
    }
    return (
        <div className="flex flex-col gap-1.5">
            <Button
                size="lg"
                loading={busy}
                disabled={ready < waiting.length}
                icon={<ScooterIcon size={20} />}
                onClick={(): void => void take()}
            >
                {t.trip.pickUpAll}
            </Button>
            {ready < waiting.length ? (
                <p className="px-1 text-sm text-tg-hint">
                    {fill(t.trip.notReady, { ready, total: waiting.length })}
                </p>
            ) : null}
        </div>
    )
}

/**
 * All the stops still to go, in order, in Yandex Navigator (or Yandex Maps), by car. Before the
 * pickup the way starts at the shop: the courier goes there first.
 */
function NavigatorLink({
    stops,
    shop,
}: {
    stops: readonly OrderDTO[]
    shop: OrderDTO["location"] | undefined
}): React.JSX.Element | null {
    const t = useT()
    const left = stops.filter((o) => !isStopDone(o))
    const atShop = left.some((o) => !onTheWay(o))
    const points = [
        ...(atShop && shop ? [shop] : []),
        ...left.flatMap((o) => (o.location ? [o.location] : [])),
    ]
    if (points.length === 0) {
        return null
    }
    return (
        <a
            href={yandexRouteUrl(points)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(): void => haptic.tap()}
            className="tap flex h-12 items-center justify-center gap-2 rounded-control bg-tg-bg font-semibold"
        >
            <PinIcon size={18} className="text-brand" />
            {t.trip.navigator}
        </a>
    )
}

/**
 * Several orders of one shop going one way, for the courier: the way on the map with the stops
 * numbered, «Hammasini oldim», Yandex Navigator through every stop, then each stop delivered on
 * its own (`renderStop`: the address, the money, «Yetkazdim»).
 */
export function TripCard({
    trip,
    orders,
    onChange,
    onStale,
    renderStop,
}: {
    trip: TripDTO
    orders: readonly CourierOrderDTO[]
    onChange(orders: OrderDTO[]): void
    onStale(): void
    renderStop(order: CourierOrderDTO, showStep: boolean): ReactNode
}): React.JSX.Element {
    const t = useT()
    const stops = tripOrders(trip, orders) as CourierOrderDTO[]
    const first = stops[0]
    const next = stops.find((o) => !isStopDone(o))
    // Another stop opened by a tap: the next customer does not answer, the one after does.
    const [opened, setOpened] = useState<string | null>(null)
    return (
        <li
            className="flex animate-rise flex-col gap-3 rounded-tile bg-tg-secondary p-4"
            aria-label={t.trip.title}
        >
            <div className="flex items-center gap-1.5 text-sm font-semibold text-tg-subtitle">
                <StoreIcon size={14} className="shrink-0" />
                <span className="truncate">{first?.shopName}</span>
            </div>
            <h3 className="text-lg font-bold">{fill(t.trip.orders, { n: stops.length })}</h3>
            {/* One shop for the whole trip: its call once, here, not under every stop. */}
            {first?.shopPhone ? (
                <CallLink phone={first.shopPhone} label={t.courier.callShop} className="bg-tg-bg" />
            ) : null}
            <TripMap trip={trip} shop={first?.shopLocation} stops={stops} />
            <TripWay trip={trip} />
            <PickUpAll trip={trip} stops={stops} onChange={onChange} onStale={onStale} />
            <NavigatorLink stops={stops} shop={first?.shopLocation} />
            <ol className="flex flex-col gap-3">
                {stops.map((order, index) => (
                    <li
                        key={order.id}
                        data-stop={index + 1}
                        data-order={order.id}
                        className={cn(
                            "flex flex-col gap-2 rounded-control border-2 p-3",
                            order === next
                                ? "border-brand bg-tg-bg"
                                : "border-transparent bg-tg-bg/60",
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <span
                                className={cn(
                                    "grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                                    isStopDone(order)
                                        ? "bg-tg-hint text-white"
                                        : "bg-brand text-brand-ink",
                                )}
                            >
                                {isStopDone(order) ? (
                                    <CheckIcon size={16} strokeWidth={2.5} />
                                ) : (
                                    index + 1
                                )}
                            </span>
                            <span className="flex-1 font-semibold">
                                #{order.number} · {order.customerName}
                            </span>
                            {order === next ? (
                                <span className="text-sm font-semibold text-brand">
                                    {t.trip.next}
                                </span>
                            ) : null}
                        </div>
                        {/* One stop at a time: the next one whole, the rest a line each that opens. */}
                        {order === next || order.id === opened ? (
                            renderStop(order, onTheWay(order))
                        ) : isStopDone(order) ? null : (
                            <button
                                type="button"
                                aria-expanded={false}
                                onClick={(): void => {
                                    haptic.select()
                                    setOpened(order.id)
                                }}
                                className="tap -mx-1 flex min-h-11 items-center gap-2 rounded-control px-1 pl-11 text-left text-sm text-tg-subtitle focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                            >
                                <span className="min-w-0 flex-1 truncate">{order.address}</span>
                                <ChevronIcon size={16} className="shrink-0 rotate-90" />
                            </button>
                        )}
                    </li>
                ))}
            </ol>
        </li>
    )
}

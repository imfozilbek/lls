import { mapUrl } from "@zumda/core"

import { useT } from "../i18n/index.js"

import { PhoneIcon, PinIcon } from "./icons.js"
import { OrderMapButton } from "./maps.js"

import type { OrderDTO } from "@zumda/core"

const LINK =
    "tap flex h-12 flex-1 items-center justify-center gap-2 rounded-control bg-tg-bg font-semibold"

/** "Call" and "Map" for an order: what the owner and the courier tap most. */
export function ContactLinks({ order }: { order: OrderDTO }): React.JSX.Element | null {
    const t = useT()
    const map = order.location ? mapUrl(order.location) : null
    if (!order.customerPhone && !map) {
        return null
    }
    return (
        <div className="flex gap-2">
            {order.customerPhone ? (
                <a href={`tel:${order.customerPhone}`} className={LINK}>
                    <PhoneIcon size={18} className="text-brand" />
                    {t.owner.call}
                </a>
            ) : null}
            {map ? (
                <a href={map} target="_blank" rel="noopener noreferrer" className={LINK}>
                    <PinIcon size={18} className="text-brand" />
                    {t.owner.map}
                </a>
            ) : null}
        </div>
    )
}

/** Address, landmark and comment in one calm block. */
export function AddressBlock({ order }: { order: OrderDTO }): React.JSX.Element {
    return (
        <div className="flex gap-2 rounded-control bg-tg-bg p-3">
            <PinIcon size={18} className="mt-0.5 shrink-0 text-brand" />
            <div className="min-w-0">
                <p className="font-medium">{order.address}</p>
                {order.landmark ? <p className="text-tg-hint">{order.landmark}</p> : null}
                {order.comment ? <p className="mt-1 italic">«{order.comment}»</p> : null}
            </div>
        </div>
    )
}

const ICON_LINK =
    "tap grid h-11 w-11 shrink-0 place-items-center rounded-full bg-tg-bg text-brand ring-1 ring-black/5"

/**
 * The owner's order list: address and landmark on one line, call and map as two round buttons.
 * A card stays short in a rush; the full block is for the courier at the door.
 */
export function CompactAddress({
    order,
    shop,
}: {
    order: OrderDTO
    /** The shop's place: the map shows where it goes from. */
    shop?: { latitude: number; longitude: number } | null
}): React.JSX.Element {
    const t = useT()
    const map = order.location ? mapUrl(order.location) : null
    return (
        <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
                <p className="line-clamp-2">
                    <span className="font-medium">{order.address}</span>
                    {order.landmark ? (
                        <span className="text-tg-hint"> · {order.landmark}</span>
                    ) : null}
                </p>
                {order.comment ? <p className="line-clamp-2 italic">«{order.comment}»</p> : null}
            </div>
            {order.customerPhone ? (
                <a
                    href={`tel:${order.customerPhone}`}
                    aria-label={t.owner.call}
                    className={ICON_LINK}
                >
                    <PhoneIcon size={20} />
                </a>
            ) : null}
            {map && order.location ? (
                <OrderMapButton
                    shop={shop}
                    customer={order.location}
                    href={map}
                    className={ICON_LINK}
                >
                    <PinIcon size={20} />
                </OrderMapButton>
            ) : null}
        </div>
    )
}

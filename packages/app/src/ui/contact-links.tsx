import { formatPhone, mapUrl } from "@zumda/core"

import { useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"

import { PhoneIcon, PinIcon } from "./icons.js"
import { OrderMapButton } from "./maps.js"

import type { OrderDTO } from "@zumda/core"

const LINK =
    "tap flex h-12 flex-1 items-center justify-center gap-2 rounded-control bg-tg-bg font-semibold"

/**
 * A call with its number on it: whom, and the digits (owner's decision, October 2026: everyone
 * on an order can call each other, and sees the number before calling).
 */
export function CallLink({
    phone,
    label,
    className,
}: {
    phone: string
    label: string
    /** The background: `bg-tg-secondary` on the page, `bg-tg-bg` inside a card. */
    className?: string
}): React.JSX.Element {
    return (
        <a
            href={`tel:${phone}`}
            onClick={(): void => haptic.tap()}
            className={cn(
                "tap flex min-h-12 flex-wrap items-center justify-center gap-x-2 rounded-control px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
                className ?? "bg-tg-secondary",
            )}
        >
            <PhoneIcon size={18} className="text-brand" />
            {label}{" "}
            <span className="font-normal tabular-nums text-tg-hint">{formatPhone(phone)}</span>
        </a>
    )
}

/** The courier's calls and map: the customer, the shop (its number, or the owner's), the way. */
export function ContactLinks({
    order,
}: {
    order: OrderDTO & { shopPhone?: string }
}): React.JSX.Element | null {
    const t = useT()
    const map = order.location ? mapUrl(order.location) : null
    if (!order.customerPhone && !order.shopPhone && !map) {
        return null
    }
    return (
        <div className="flex flex-col gap-2">
            {order.customerPhone ? (
                <CallLink
                    phone={order.customerPhone}
                    label={t.courier.callCustomer}
                    className="bg-tg-bg"
                />
            ) : null}
            {order.shopPhone ? (
                <CallLink phone={order.shopPhone} label={t.courier.callShop} className="bg-tg-bg" />
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
 * The owner's order list: the call to the customer with the number, then the address and
 * landmark on one line with the map as a round button. A card stays short in a rush; the full
 * block is for the courier at the door.
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
        <div className="flex flex-col gap-2">
            {order.customerPhone ? (
                <CallLink phone={order.customerPhone} label={t.owner.call} className="bg-tg-bg" />
            ) : null}
            <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                    <p className="line-clamp-2">
                        <span className="font-medium">{order.address}</span>
                        {order.landmark ? (
                            <span className="text-tg-hint"> · {order.landmark}</span>
                        ) : null}
                    </p>
                    {order.comment ? (
                        <p className="line-clamp-2 italic">«{order.comment}»</p>
                    ) : null}
                </div>
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
        </div>
    )
}

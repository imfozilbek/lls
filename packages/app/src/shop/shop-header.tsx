import {
    PaymentMethod,
    PaymentStatus,
    WEEKDAYS,
    isFinalStatus,
    mapUrl,
    toLocalTime,
} from "@zumda/core"
import { useEffect, useMemo, useState } from "react"

import { fill, useLanguage, useT } from "../i18n/index.js"
import { api, imageUrl } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { reportMissingImage } from "../lib/crashes.js"
import { deliveryFact, shopDelivery } from "../lib/delivery-price.js"
import { formatMoney, kmText } from "../lib/format.js"
import { opensWhen } from "../lib/opening.js"
import { takesOrdersNow } from "../lib/shop-ready.js"
import { callLink, haptic, openChatAndClose } from "../lib/telegram.js"
import { useCachedState } from "../lib/use-cached.js"
import { useRouter } from "../stores/router.js"
import {
    CardIcon,
    ChatIcon,
    ChevronIcon,
    PhoneIcon,
    PinIcon,
    ReceiptIcon,
    StoreIcon,
} from "../ui/icons.js"
import { LanguageSwitch } from "../ui/language-switch.js"
import { MapButton } from "../ui/maps.js"
import { ShopLogo } from "../ui/shop-logo.js"

import type { Dictionary } from "../i18n/index.js"
import type { Shop } from "../stores/session.js"
import type { MapMarker } from "../ui/maps.js"
import type { Language } from "@zumda/core"

/** "Today 9:00–22:00" or "day off" in Tashkent time; nothing for shops that are always open. */
function hoursToday(shop: Shop, t: Dictionary): string | null {
    if (shop.workingHours === null) {
        return null
    }
    const day = WEEKDAYS[toLocalTime(new Date()).weekday]
    const range = day ? shop.workingHours[day] : undefined
    if (!range) {
        return t.shop.dayOff
    }
    // The same opening and closing time is the whole day (as the server counts it).
    return range.open === range.close
        ? t.shop.openAllDay
        : fill(t.shop.hoursToday, { from: range.open, to: range.close })
}

/** «Yopiq · ertaga soat 9:00 da ochiladi»: when to come back, not only that it is closed. */
function closedStatus(t: Dictionary, shop: Shop): string {
    const when = opensWhen(t, shop.workingHours)
    return when ? fill(t.shop.closedUntil, { when }) : t.shop.closed
}

/** Short facts customers need before ordering: delivery price, free-from, minimum, hours. */
function shopFacts(shop: Shop, t: Dictionary, language: Language): string[] {
    const { delivery } = shop
    const money = (amount: number): string => formatMoney(amount, language)
    // Only what the shop said: nothing about delivery until the owner chose its price.
    const price = deliveryFact(shopDelivery(delivery), {
        free: t.shop.deliveryFree,
        // Sent across the country: where to, not when the price comes.
        later: delivery.nationwide ? t.shop.deliveryNationwide : t.shop.deliveryApart,
        fee: (sum) => fill(t.shop.deliveryFee, { sum: money(sum) }),
    })
    const facts = price ? [price] : []
    if (delivery.freeFrom && delivery.fee > 0) {
        facts.push(fill(t.shop.freeFrom, { sum: money(delivery.freeFrom) }))
    }
    if (delivery.minOrder) {
        facts.push(fill(t.shop.minOrder, { sum: money(delivery.minOrder) }))
    }
    if (delivery.radiusMeters !== undefined) {
        facts.push(fill(t.shop.radius, { km: kmText(delivery.radiusMeters) }))
    }
    const hours = hoursToday(shop, t)
    if (hours) {
        facts.push(hours)
    }
    return facts
}

/** The customer's orders at a glance: one on its way (a dot), one still to pay by transfer. */
interface OrdersGlance {
    active: boolean
    unpaid: { id: string; number: number; total: number } | null
}

/**
 * Whether the customer has an order on its way here («Buyurtmalarim» wears a dot), and the
 * transfer still to send: back from the bank app the way to «Chekni yuklash» is right on top.
 */
function useOrdersGlance(shopId: string | undefined): OrdersGlance {
    // Known at once on a return to the menu: the dot never pops in late a second time.
    const [glance, setGlance] = useCachedState<OrdersGlance>("orders-glance")
    useEffect(() => {
        if (!shopId) {
            return undefined
        }
        let alive = true
        api.myOrders()
            .then((page) => {
                if (!alive) {
                    return
                }
                const open = page.data.filter((order) => !isFinalStatus(order.status))
                const unpaid = open.find(
                    (order) =>
                        order.payment.method === PaymentMethod.CARD_TRANSFER &&
                        order.payment.status === PaymentStatus.UNPAID,
                )
                setGlance({
                    active: open.length > 0,
                    unpaid: unpaid
                        ? { id: unpaid.id, number: unpaid.number, total: unpaid.total }
                        : null,
                })
                // A new phone: the newest order's place fills the checkout (no new request).
                // The address book loads with the checkout, not with the storefront.
                const newest = page.data[0]
                if (newest) {
                    void import("../lib/address-book.js")
                        .then((book) => book.rememberFromOrder(newest))
                        .catch(() => undefined)
                }
            })
            .catch(() => undefined)
        return (): void => {
            alive = false
        }
    }, [shopId, setGlance])
    return glance ?? { active: false, unpaid: null }
}

/** «Buyurtma #12: 55 000 so'm o'tkazing»: one tap to the card and «Chekni yuklash». */
function UnpaidBanner({
    order,
}: {
    order: NonNullable<OrdersGlance["unpaid"]>
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const push = useRouter((state) => state.push)
    return (
        <button
            type="button"
            onClick={(): void => {
                haptic.tap()
                push({ name: "order", id: order.id })
            }}
            className="tap mx-4 mt-3 flex w-[calc(100%-2rem)] animate-rise items-center gap-3 rounded-control bg-warning/15 px-4 py-3 text-left"
        >
            <CardIcon size={22} className="shrink-0 text-warning" />
            <span className="flex-1 text-sm font-semibold">
                {fill(t.shop.unpaidOrder, {
                    n: order.number,
                    sum: formatMoney(order.total, language),
                })}
            </span>
            <ChevronIcon size={18} className="shrink-0 text-tg-hint" />
        </button>
    )
}

/**
 * One of the header's buttons (owner's decision, November 2026): a white pill, the icon beside its
 * word, 38 px high with room around it (a finger's 44 px, `visual.spec`). 13 px: the smallest
 * words the app writes.
 */
const ACTION =
    "tap relative flex h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
const ACTION_PLAIN = "bg-tg-secondary text-tg-text"
const ACTION_ICON = "shrink-0 text-brand"

function HeaderAction({
    icon,
    label,
    onClick,
    accent = false,
    badge,
}: {
    icon: React.JSX.Element
    label: string
    onClick(): void
    accent?: boolean
    /** A dot on the button, and these words for screen readers. */
    badge?: string
}): React.JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(ACTION, accent ? "bg-brand text-brand-ink" : ACTION_PLAIN)}
        >
            <span className={accent ? "shrink-0" : ACTION_ICON}>{icon}</span>
            {label}
            {badge ? (
                <>
                    <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-brand ring-2 ring-tg-bg" />
                    <span className="sr-only">, {badge}</span>
                </>
            ) : null}
        </button>
    )
}

/** «Xarita»: where the shop is and how far it delivers (the map loads only on a tap). */
function MapAction({ shop }: { shop: Shop }): React.JSX.Element | null {
    const t = useT()
    const location = shop.location
    const radius = shop.delivery.radiusMeters
    const markers = useMemo(
        (): MapMarker[] =>
            location ? [{ id: "shop", point: location, kind: "shop", title: shop.name }] : [],
        [location, shop.name],
    )
    const zone = useMemo(
        () =>
            location && radius !== undefined ? { center: location, radiusMeters: radius } : null,
        [location, radius],
    )
    if (!location) {
        return null
    }
    return (
        <MapButton
            markers={markers}
            zone={zone}
            href={mapUrl(location)}
            label={t.shop.map}
            className={cn(ACTION, ACTION_PLAIN)}
        >
            <PinIcon size={18} className={ACTION_ICON} />
            {t.shop.map}
        </MapButton>
    )
}

/**
 * The header's round buttons in one row, scrolled sideways on a narrow phone: the customer's
 * orders, the map, the call (unless the owner keeps the number back) and «Savolim bor»; the
 * owner sees «Mening do'konim» instead of the call and the question.
 */
function HeaderActions({ shop, glance }: { shop: Shop; glance: OrdersGlance }): React.JSX.Element {
    const t = useT()
    const push = useRouter((state) => state.push)
    const owner = shop.viewerRole === "owner"
    const call = Boolean(shop.callPhone) && !owner
    const ask = shop.supportChat && !owner
    return (
        // One row; a narrow phone scrolls it sideways, like the tabs.
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <HeaderAction
                icon={<ReceiptIcon size={18} />}
                label={t.shop.myOrders}
                badge={glance.active ? t.shop.activeOrder : undefined}
                onClick={(): void => {
                    haptic.tap()
                    push({ name: "orders" })
                }}
            />
            <MapAction shop={shop} />
            {/* The shop's number (or the owner's): one tap from the storefront. */}
            {call && shop.callPhone ? (
                <a
                    {...callLink(shop.callPhone)}
                    onClick={(): void => haptic.tap()}
                    className={cn(ACTION, ACTION_PLAIN)}
                >
                    <PhoneIcon size={18} className={ACTION_ICON} />
                    {t.shop.call}
                </a>
            ) : null}
            {/* «Savolim bor» (goal 23): the shop answers in its bot, from its support group. */}
            {ask ? (
                <HeaderAction
                    icon={<ChatIcon size={18} />}
                    label={t.order.writeShop}
                    onClick={(): void => {
                        haptic.tap()
                        openChatAndClose(`https://t.me/${shop.botUsername}?start=q_s`)
                    }}
                />
            ) : null}
            {owner ? (
                <HeaderAction
                    icon={<StoreIcon size={18} />}
                    label={t.shop.manage}
                    onClick={(): void => push({ name: "owner" })}
                    accent
                />
            ) : null}
        </div>
    )
}

/** «Muqova rasmi» (goal 24): the shop's wide picture; a file that will not load leaves no gap. */
function ShopCover({ src }: { src: string }): React.JSX.Element | null {
    const [failed, setFailed] = useState<string | null>(null)
    if (failed === src) {
        return null
    }
    return (
        <div className="pic-frame aspect-[5/2] max-h-56 w-full overflow-hidden rounded-b-[1.5rem] border-t-0 bg-tg-secondary">
            <img
                src={src}
                alt=""
                className="h-full w-full animate-fade-in object-cover"
                onError={(): void => {
                    setFailed(src)
                    void reportMissingImage(src, "cover")
                }}
            />
        </div>
    )
}

/**
 * The storefront's top (owner's decision, November 2026; goal 24): the cover when the shop has
 * one, the logo over its edge, the name with whether it takes orders now, one line of facts, and
 * the round buttons.
 */
export function ShopHeader({ shop }: { shop: Shop }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const glance = useOrdersGlance(shop.id)
    const cover = imageUrl(shop.coverKey)
    const status = shop.opensSoon
        ? t.shop.opensSoon
        : shop.paymentMethods.length === 0
          ? t.shop.soon
          : !shop.acceptingOrders
            ? t.shop.paused
            : shop.isOpen
              ? t.shop.open
              : closedStatus(t, shop)
    return (
        <header className="pb-2">
            {cover ? <ShopCover src={cover} /> : null}
            <div
                className={cn("flex gap-3 px-4", cover ? "-mt-9 items-start" : "items-center pt-4")}
            >
                <ShopLogo
                    name={shop.name}
                    logoKey={shop.logoKey}
                    className={cn(
                        "relative rounded-[1.1rem] text-2xl shadow-card ring-[3px] ring-tg-section",
                        cover ? "h-[4.5rem] w-[4.5rem]" : "h-14 w-14",
                    )}
                />
                {/* Under a cover the words start below its edge: only the logo sits on it. */}
                <div className={cn("min-w-0 flex-1 pb-0.5", cover && "pt-10")}>
                    <h1 className="truncate text-xl font-bold leading-tight">{shop.name}</h1>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-tg-hint">
                        <span
                            className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                takesOrdersNow(shop) ? "bg-success" : "bg-tg-hint",
                            )}
                        />
                        <span className="truncate">{status}</span>
                    </p>
                </div>
                <LanguageSwitch />
            </div>
            <p className="mt-2.5 px-4 text-sm text-tg-subtitle">
                {shopFacts(shop, t, language).join(" · ")}
            </p>
            {shop.demo ? (
                <p
                    role="note"
                    className="mx-4 mt-3 rounded-control bg-warning/15 px-3 py-2 text-sm font-semibold"
                >
                    {t.shop.demo}
                </p>
            ) : null}
            <HeaderActions shop={shop} glance={glance} />
            {glance.unpaid && shop.viewerRole !== "owner" ? (
                <UnpaidBanner order={glance.unpaid} />
            ) : null}
        </header>
    )
}

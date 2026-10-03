import { BusinessStatus } from "@zumda/core"
import { useEffect, useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import {
    BagIcon,
    CardIcon,
    CheckIcon,
    ChevronIcon,
    ClockIcon,
    ImageIcon,
    PinIcon,
    ScooterIcon,
} from "../ui/icons.js"
import { Button } from "../ui/primitives.js"

import { useOwner } from "./store.js"

import type { ReadySection } from "./store.js"
import type { Dictionary } from "../i18n/index.js"
import type { ShopOwnerDTO } from "@zumda/core"
import type { ReactNode } from "react"

/** Enough of a catalog for a first customer to find something. */
const FIRST_PRODUCTS = 3
const SELF_DELIVERY_KEY = "zumda.selfDelivery."

interface ReadyItem {
    id: ReadySection | "products"
    icon: ReactNode
    title: string
    hint: string
    done: boolean
}

function readSelfDelivery(shopId: string): boolean {
    try {
        return window.localStorage.getItem(SELF_DELIVERY_KEY + shopId) === "1"
    } catch {
        return false
    }
}

function saveSelfDelivery(shopId: string): void {
    try {
        window.localStorage.setItem(SELF_DELIVERY_KEY + shopId, "1")
    } catch {
        // Private mode: the tick lasts until the app closes.
    }
}

function itemsOf(
    t: Dictionary["owner"]["ready"],
    state: {
        hasCard: boolean
        located: boolean
        hasHours: boolean
        products: number
        hasLogo: boolean
        delivers: boolean
    },
): ReadyItem[] {
    return [
        {
            id: "card",
            icon: <CardIcon size={20} />,
            title: t.card,
            hint: t.cardHint,
            done: state.hasCard,
        },
        {
            id: "location",
            icon: <PinIcon size={20} />,
            title: t.location,
            hint: t.locationHint,
            done: state.located,
        },
        {
            id: "hours",
            icon: <ClockIcon size={20} />,
            title: t.hours,
            hint: t.hoursHint,
            done: state.hasHours,
        },
        {
            id: "products",
            icon: <BagIcon size={20} />,
            title: t.products,
            hint: fill(t.productsHint, { n: state.products }),
            done: state.products >= FIRST_PRODUCTS,
        },
        {
            id: "logo",
            icon: <ImageIcon size={20} />,
            title: t.logo,
            hint: t.logoHint,
            done: state.hasLogo,
        },
        {
            id: "courier",
            icon: <ScooterIcon size={20} />,
            title: t.courier,
            hint: t.courierHint,
            done: state.delivers,
        },
    ]
}

function ReadyRow({
    item,
    onOpen,
    extra,
}: {
    item: ReadyItem
    onOpen(): void
    extra?: ReactNode
}): React.JSX.Element {
    return (
        <li className="flex items-center gap-2">
            <button
                type="button"
                disabled={item.done}
                onClick={(): void => {
                    haptic.tap()
                    onOpen()
                }}
                className="tap flex min-h-[52px] flex-1 items-center gap-3 rounded-control px-2 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:active:scale-100"
            >
                <span
                    className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors duration-300",
                        item.done ? "bg-success/15 text-success" : "bg-brand/10 text-brand",
                    )}
                >
                    {item.done ? (
                        <CheckIcon size={18} strokeWidth={2.5} className="animate-pop" />
                    ) : (
                        item.icon
                    )}
                </span>
                <span className="min-w-0 flex-1">
                    {/* Done reads as done by its tick: the words stay whole, just quieter. */}
                    <span
                        className={cn(
                            "block",
                            item.done ? "font-medium text-tg-subtitle" : "font-semibold",
                        )}
                    >
                        {item.title}
                    </span>
                    {item.done ? null : (
                        <span className="block text-sm text-tg-subtitle">{item.hint}</span>
                    )}
                </span>
                {item.done ? null : <ChevronIcon size={18} className="text-tg-hint" />}
            </button>
            {extra}
        </li>
    )
}

/** With orders waiting, «Ishga tayyor» is one line: the progress and the next step. */
function FoldedReady({
    progress,
    next,
    onOpen,
}: {
    progress: string
    next: string
    onOpen(): void
}): React.JSX.Element {
    const t = useT().owner.ready
    return (
        <button
            type="button"
            aria-expanded={false}
            onClick={(): void => {
                haptic.tap()
                onOpen()
            }}
            className="tap mx-4 mt-3 flex w-[calc(100%-2rem)] animate-rise items-center gap-3 rounded-tile bg-tg-secondary px-4 py-3 text-left"
        >
            <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-sm font-bold tabular-nums">
                {progress}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t.title}</span>
                <span className="block truncate text-sm text-tg-subtitle">
                    {fill(t.next, { item: next })}
                </span>
            </span>
            <ChevronIcon size={18} className="shrink-0 text-tg-hint" />
        </button>
    )
}

/**
 * «Ishga tayyor»: what a new business still needs before its first customer. Each row leads to
 * the place it is done; the card disappears once everything is ready.
 */
export function ReadyCard(): React.JSX.Element | null {
    const t = useT().owner.ready
    const shop = useSession((state) => state.shop)
    const products = useOwner((state) => state.products)
    const couriers = useOwner((state) => state.couriers)
    const loadProducts = useOwner((state) => state.loadProducts)
    const loadCouriers = useOwner((state) => state.loadCouriers)
    const goToSection = useOwner((state) => state.goToSection)
    const setTab = useOwner((state) => state.setTab)
    const [selfDelivery, setSelfDelivery] = useState(() =>
        shop ? readSelfDelivery(shop.id) : false,
    )
    const activeOrders = useOwner((state) => state.activeOrders)
    const focusOrderId = useOwner((state) => state.focusOrderId)
    const [expanded, setExpanded] = useState(false)
    const folded = !expanded && ((activeOrders ?? 0) > 0 || focusOrderId !== null)
    useEffect(() => {
        loadProducts().catch(() => undefined)
        loadCouriers().catch(() => undefined)
    }, [loadProducts, loadCouriers])
    if (!shop || products === null || couriers === null) {
        return null
    }
    const items = itemsOf(t, {
        hasCard: shop.hasPayoutCard,
        located: shop.location !== undefined,
        hasHours: shop.workingHours !== null,
        products: products.length,
        hasLogo: shop.logoKey !== undefined,
        delivers: selfDelivery || couriers.some((courier) => courier.isActive),
    })
    const done = items.filter((item) => item.done).length
    if (done === items.length) {
        return null
    }
    const next = items.find((item) => !item.done)
    if (folded && next) {
        return (
            <FoldedReady
                progress={fill(t.progress, { done, all: items.length })}
                next={next.title}
                onOpen={(): void => setExpanded(true)}
            />
        )
    }
    const open = (item: ReadyItem): void =>
        item.id === "products" ? setTab("menu") : goToSection(item.id)
    return (
        <section
            aria-label={t.title}
            className="mx-4 mt-3 animate-rise rounded-tile bg-tg-secondary p-3"
        >
            <div className="flex items-center justify-between px-2 pb-1">
                <h2 className="text-lg font-bold">{t.title}</h2>
                <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-sm font-bold tabular-nums">
                    {fill(t.progress, { done, all: items.length })}
                </span>
            </div>
            <div
                className="mx-2 mb-2 h-1.5 overflow-hidden rounded-full bg-tg-bg"
                aria-hidden="true"
            >
                <div
                    className="h-full origin-left rounded-full bg-brand transition-transform duration-500 ease-out-quart"
                    style={{ transform: `scaleX(${done / items.length})` }}
                />
            </div>
            <ul className="flex flex-col">
                {items.map((item) => (
                    <ReadyRow
                        key={item.id}
                        item={item}
                        onOpen={(): void => open(item)}
                        extra={
                            item.id === "courier" && !item.done ? (
                                <button
                                    type="button"
                                    onClick={(): void => {
                                        haptic.success()
                                        saveSelfDelivery(shop.id)
                                        setSelfDelivery(true)
                                    }}
                                    className="tap shrink-0 rounded-full bg-tg-bg px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                                >
                                    {t.selfDeliver}
                                </button>
                            ) : null
                        }
                    />
                ))}
            </ul>
        </section>
    )
}

/**
 * Where the application stands: under review (the bot already answers), rejected with the reason
 * and «Tuzatib qayta yuborish», or turned off by Zumda.
 */
export function StatusBanner(): React.JSX.Element | null {
    const t = useT()
    const [shop, setShop] = useState<ShopOwnerDTO | null>(null)
    const [busy, setBusy] = useState(false)
    useEffect(() => {
        api.owner
            .shop()
            .then(setShop)
            .catch(() => undefined)
    }, [])
    if (!shop || shop.status === BusinessStatus.ACTIVE) {
        return null
    }
    const resubmit = async (): Promise<void> => {
        setBusy(true)
        try {
            setShop(await api.owner.resubmit())
            haptic.success()
            toast(t.onboarding.resubmitted, "success")
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setBusy(false)
        }
    }
    if (shop.status === BusinessStatus.PENDING) {
        return (
            <p className="mx-4 mt-3 flex animate-rise items-start gap-3 rounded-tile bg-warning/15 p-4 text-sm font-medium">
                <ClockIcon size={20} className="mt-0.5 shrink-0 text-warning" />
                {t.owner.pendingBanner}
            </p>
        )
    }
    if (!shop.rejection) {
        return (
            <p className="mx-4 mt-3 animate-rise rounded-tile bg-danger/10 p-4 text-sm font-medium">
                {t.owner.disabledBanner}
            </p>
        )
    }
    return (
        <div className="mx-4 mt-3 flex animate-rise flex-col gap-3 rounded-tile bg-danger/10 p-4">
            <p className="font-bold">{t.owner.rejectedBanner}</p>
            {shop.rejection.reason ? (
                <p className="text-sm">
                    {fill(t.onboarding.rejectedReason, { reason: shop.rejection.reason })}
                </p>
            ) : null}
            <Button loading={busy} onClick={(): void => void resubmit()}>
                {t.onboarding.resubmit}
            </Button>
        </div>
    )
}

import { CourierStatus, OrderStatus, PaymentStatus } from "@zumda/core"
import { useCallback, useEffect, useRef, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api, setCourierBot } from "../lib/api.js"
import { ZUMDA_BRAND_COLOR, ZUMDA_NAME, applyBrand } from "../lib/brand.js"
import { formatMoney } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { AddressBlock, ContactLinks } from "../ui/contact-links.js"
import { CheckIcon, ClockIcon, ScooterIcon, StoreIcon, WifiOffIcon } from "../ui/icons.js"
import { OrderItems } from "../ui/order-items.js"
import { StatusBadge } from "../ui/order-status.js"
import {
    Button,
    EmptyState,
    Field,
    PoweredBy,
    Skeleton,
    Switch,
    TextInput,
} from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"
import { ZumdaMark } from "../ui/zumda-mark.js"

import type { Dictionary } from "../i18n/index.js"
import type {
    CourierHomeDTO,
    CourierOrderDTO,
    CourierShopDTO,
    NetworkOrderDTO,
    OrderDTO,
} from "@zumda/core"

const POLL_MS = 20_000
const METERS_PER_KM = 1000

/** The one step a courier makes next, if any. */
function courierStep(status: OrderStatus): "picked_up" | "delivered" | null {
    if (status === OrderStatus.READY) {
        return "picked_up"
    }
    return status === OrderStatus.PICKED_UP ? "delivered" : null
}

function isActive(order: CourierOrderDTO): boolean {
    return order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.CANCELLED
}

function StepButton({
    order,
    onChange,
    onStale,
}: {
    order: OrderDTO
    onChange(order: OrderDTO): void
    onStale(): void
}): React.JSX.Element {
    const t = useT()
    const [busy, setBusy] = useState(false)
    const step = courierStep(order.status)
    if (!step) {
        return (
            <p className="flex items-center gap-2 rounded-control bg-tg-bg p-3 text-sm text-tg-hint">
                <ClockIcon size={18} className="shrink-0" />
                {t.courier.waitReady}
            </p>
        )
    }
    const go = async (): Promise<void> => {
        setBusy(true)
        try {
            onChange(await api.courier.setStatus(order.id, step))
            haptic.success()
        } catch (caught) {
            haptic.error()
            const code = caught instanceof ApiError ? caught.code : "generic"
            toast(errorText(t, code), "error")
            // Someone else moved or reassigned it: show the truth.
            onStale()
        } finally {
            setBusy(false)
        }
    }
    return (
        <Button
            size="lg"
            loading={busy}
            icon={step === "delivered" ? <CheckIcon size={20} /> : <ScooterIcon size={20} />}
            onClick={(): void => void go()}
        >
            {step === "delivered" ? t.courier.delivered : t.courier.pickedUp}
        </Button>
    )
}

/** Paid to the shop's card before the shop started: the courier takes no money at the door. */
function Collect({ order }: { order: OrderDTO }): React.JSX.Element {
    const t = useT()
    const paid = order.payment.status === PaymentStatus.PAID
    return (
        <p
            className={`flex items-center gap-2 rounded-control px-4 py-3 font-medium ${
                paid ? "bg-success/15" : "bg-warning/15"
            }`}
        >
            {paid ? (
                <CheckIcon size={20} className="shrink-0 text-success" />
            ) : (
                <ClockIcon size={20} className="shrink-0 text-warning" />
            )}
            {paid ? t.courier.nothingToCollect : t.courier.notPaidYet}
        </p>
    )
}

function DeliveryCard({
    order,
    onChange,
    onStale,
}: {
    order: CourierOrderDTO
    onChange(order: OrderDTO): void
    onStale(): void
}): React.JSX.Element {
    const t = useT()
    return (
        <li className="flex animate-rise flex-col gap-3 rounded-tile bg-tg-secondary p-4">
            <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-tg-subtitle">
                        <StoreIcon size={14} className="shrink-0" />
                        <span className="truncate">{order.shopName}</span>
                    </span>
                    <span className="text-lg font-bold">#{order.number}</span>
                </span>
                <StatusBadge status={order.status} />
            </div>
            <p className="font-medium">{order.customerName}</p>
            <AddressBlock order={order} />
            <ContactLinks order={order} />
            <Collect order={order} />
            {order.bottlesReturned > 0 ? (
                <p className="px-1 font-medium">
                    {fill(t.courier.bottles, { n: order.bottlesReturned })}
                </p>
            ) : null}
            <details className="group">
                <summary className="tap cursor-pointer list-none px-1 py-2 text-sm font-medium text-brand">
                    {t.order.items} · {order.items.length}
                </summary>
                <OrderItems order={order} />
            </details>
            <StepButton order={order} onChange={onChange} onStale={onStale} />
        </li>
    )
}

function DoneRow({ order }: { order: CourierOrderDTO }): React.JSX.Element {
    const language = useLanguage()
    return (
        <li className="flex items-center gap-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                <CheckIcon size={18} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate">
                    #{order.number} · {order.address}
                </span>
                <span className="block truncate text-sm text-tg-hint">{order.shopName}</span>
            </span>
            <span className="shrink-0 tabular-nums text-tg-hint">
                {formatMoney(order.total, language)}
            </span>
        </li>
    )
}

/** Everything on the screen, refreshed calmly while it is visible. */
function useHome(): {
    home: CourierHomeDTO | null
    error: string | null
    reload(): Promise<void>
    replace(order: OrderDTO): void
    setHome(home: CourierHomeDTO): void
} {
    const [home, setHome] = useState<CourierHomeDTO | null>(null)
    const [error, setError] = useState<string | null>(null)
    const reload = useCallback(async (): Promise<void> => {
        try {
            setHome(await api.courier.home())
            setError(null)
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "generic")
        }
    }, [])
    useEffect(() => {
        void reload()
        const timer = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void reload()
            }
        }, POLL_MS)
        return (): void => window.clearInterval(timer)
    }, [reload])
    const replace = (order: OrderDTO): void => {
        setHome((current) =>
            current
                ? {
                      ...current,
                      orders: current.orders.map((o) =>
                          o.id === order.id ? { ...order, shopName: o.shopName } : o,
                      ),
                  }
                : current,
        )
        // Cash taken at the door adds to what the courier holds for that shop.
        void reload()
    }
    return { home, error, reload, replace, setHome }
}

/** "Я на смене": shops give orders only to couriers on shift; it ends at midnight. */
function ShiftCard({
    home,
    onChange,
}: {
    home: CourierHomeDTO
    onChange(home: CourierHomeDTO): void
}): React.JSX.Element {
    const t = useT()
    const [busy, setBusy] = useState(false)
    const toggle = async (onShift: boolean): Promise<void> => {
        // One press at a time: a second one would race the first.
        if (busy) {
            return
        }
        setBusy(true)
        try {
            const profile = await api.courier.shift(onShift)
            onChange({ ...home, profile })
            haptic.success()
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setBusy(false)
        }
    }
    const on = home.profile.onShift
    return (
        <div
            className={`flex items-center gap-3 rounded-tile p-4 transition-colors duration-300 ${
                on ? "bg-success/15" : "bg-tg-secondary"
            }`}
            aria-busy={busy || undefined}
        >
            <span className="flex-1">
                <span className="block font-semibold">{t.courier.shift}</span>
                <span className="text-sm text-tg-hint">{t.courier.shiftHint}</span>
            </span>
            <Switch
                checked={on}
                onChange={(next): void => void toggle(next)}
                label={t.courier.shift}
            />
        </div>
    )
}

/** One shop the courier works for: today or a day off, and that shop's cash on their hands. */
/** «Беру заказы района»: the courier's own consent to the district network. */
function NetworkCard({
    home,
    onChange,
}: {
    home: CourierHomeDTO
    onChange(home: CourierHomeDTO): void
}): React.JSX.Element {
    const t = useT()
    const [busy, setBusy] = useState(false)
    const toggle = async (inNetwork: boolean): Promise<void> => {
        if (busy) {
            return
        }
        setBusy(true)
        try {
            const profile = await api.courier.network(inNetwork)
            onChange({ ...home, profile, network: inNetwork ? home.network : [] })
            haptic.success()
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setBusy(false)
        }
    }
    return (
        <div
            className="flex items-center gap-3 rounded-tile bg-tg-secondary p-4"
            aria-busy={busy || undefined}
        >
            <span className="flex-1">
                <span className="block font-semibold">{t.courier.network}</span>
                <span className="text-sm text-tg-hint">{t.courier.networkHint}</span>
            </span>
            <Switch
                checked={home.profile.inNetwork}
                onChange={(next): void => void toggle(next)}
                label={t.courier.network}
            />
        </div>
    )
}

const MINUTE_MS = 60_000

/** How long the order has waited for a courier: the longer, the sooner someone should take it. */
function waitingText(t: Dictionary, requestedAt: string): string {
    const minutes = Math.floor((Date.now() - Date.parse(requestedAt)) / MINUTE_MS)
    return minutes < 1 ? t.courier.waitingNow : fill(t.courier.waitingFor, { n: minutes })
}

/** One network order nearby: the shop, what to take, how far; nothing about the customer. */
function NearbyCard({
    offer,
    onTaken,
    onStale,
}: {
    offer: NetworkOrderDTO
    onTaken(): void
    onStale(): void
}): React.JSX.Element {
    const t = useT()
    const [busy, setBusy] = useState(false)
    const take = async (): Promise<void> => {
        setBusy(true)
        try {
            await api.courier.claim(offer.id)
            haptic.success()
            onTaken()
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
            onStale()
        } finally {
            setBusy(false)
        }
    }
    return (
        <li className="flex animate-rise flex-col gap-3 rounded-tile border border-brand/30 bg-brand/5 p-4">
            <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold">
                        <StoreIcon size={16} className="shrink-0 text-brand" />
                        <span className="truncate">{offer.shopName}</span>
                    </span>
                    {offer.shopAddress ? (
                        <span className="block truncate text-sm text-tg-hint">
                            {offer.shopAddress}
                        </span>
                    ) : null}
                </span>
                <span className="shrink-0 text-lg font-bold">#{offer.number}</span>
            </div>
            <p className="flex flex-wrap gap-x-3 text-sm text-tg-subtitle">
                <span>{fill(t.courier.items, { n: offer.itemsCount })}</span>
                {/* Never the customer's address before «Olaman»: only how far, when the pin is known. */}
                <span>
                    {offer.distanceMeters === undefined
                        ? t.courier.distanceUnknown
                        : fill(t.courier.distance, {
                              km: (offer.distanceMeters / METERS_PER_KM)
                                  .toFixed(1)
                                  .replace(".", ","),
                          })}
                </span>
                {offer.bottlesReturned > 0 ? (
                    <span>{fill(t.courier.bottles, { n: offer.bottlesReturned })}</span>
                ) : null}
                <span>{waitingText(t, offer.requestedAt)}</span>
            </p>
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{t.courier.nothingToCollect}</span>
                <Button
                    loading={busy}
                    className="shrink-0"
                    icon={<ScooterIcon size={18} />}
                    onClick={(): void => void take()}
                >
                    {t.courier.take}
                </Button>
            </div>
        </li>
    )
}

function Nearby({
    home,
    reload,
}: {
    home: CourierHomeDTO
    reload(): Promise<void>
}): React.JSX.Element | null {
    const t = useT()
    if (!home.profile.inNetwork) {
        return null
    }
    return (
        <section className="flex flex-col gap-2">
            <h2 className="px-1 text-sm font-semibold text-tg-subtitle">
                {t.courier.nearby}
                {home.network.length > 0 ? ` · ${home.network.length}` : ""}
            </h2>
            {home.network.length === 0 ? (
                <p className="rounded-tile bg-tg-secondary px-4 py-3 text-sm text-tg-hint">
                    {t.courier.nearbyEmpty}
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {home.network.map((offer) => (
                        <NearbyCard
                            key={offer.id}
                            offer={offer}
                            onTaken={(): void => void reload()}
                            onStale={(): void => void reload()}
                        />
                    ))}
                </ul>
            )}
        </section>
    )
}

/** Where the courier stands with this shop today: the one line they come here to read. */
function shopStanding(t: Dictionary, shop: CourierShopDTO): string {
    if (shop.status === CourierStatus.NETWORK) {
        return t.courier.networkShop
    }
    if (shop.status === CourierStatus.PENDING) {
        return t.courier.awaitingApproval
    }
    return shop.worksToday ? t.courier.worksToday : t.courier.dayOff
}

function ShopRow({ shop }: { shop: CourierShopDTO }): React.JSX.Element {
    const t = useT()
    return (
        <li className="flex items-center gap-3 py-2.5">
            <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                    shop.worksToday ? "bg-brand/15 text-brand" : "bg-tg-hint/15 text-tg-hint"
                }`}
            >
                <StoreIcon size={18} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{shop.shopName}</span>
                <span
                    className={`block text-sm ${shop.worksToday ? "font-medium text-tg-subtitle" : "text-tg-hint"}`}
                >
                    {shopStanding(t, shop)}
                </span>
            </span>
        </li>
    )
}

/** What the courier drives: shops see it next to the name. */
const VEHICLE_SAVE_MS = 1500

function VehicleField({
    home,
    onChange,
}: {
    home: CourierHomeDTO
    onChange(home: CourierHomeDTO): void
}): React.JSX.Element {
    const t = useT()
    const saved = home.profile.vehicle ?? ""
    const [value, setValue] = useState(saved)
    const lastSaved = useRef(saved)
    const save = async (text: string): Promise<void> => {
        if (text.trim() === lastSaved.current) {
            return
        }
        lastSaved.current = text.trim()
        try {
            const profile = await api.courier.profile(text.trim() || null)
            lastSaved.current = profile.vehicle ?? ""
            onChange({ ...home, profile })
            haptic.success()
            toast(t.courier.vehicleSaved, "success")
        } catch (caught) {
            lastSaved.current = saved
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        }
    }
    // Saved after a short pause too: closing the app right after typing loses nothing.
    useEffect(() => {
        const timer = window.setTimeout(() => void save(value), VEHICLE_SAVE_MS)
        return (): void => window.clearTimeout(timer)
    }, [value])
    return (
        <Field label={t.courier.vehicle} htmlFor="vehicle">
            <TextInput
                id="vehicle"
                value={value}
                maxLength={40}
                placeholder={t.courier.vehiclePlaceholder}
                onChange={(e): void => setValue(e.target.value)}
                onBlur={(): void => void save(value)}
            />
        </Field>
    )
}

function Deliveries({
    home,
    replace,
    reload,
}: {
    home: CourierHomeDTO
    replace(order: OrderDTO): void
    reload(): Promise<void>
}): React.JSX.Element {
    const t = useT()
    const active = home.orders.filter(isActive)
    const done = home.orders.filter((o) => o.status === OrderStatus.DELIVERED)
    // Orders nearby are already on screen above: «nothing to deliver» would contradict them.
    const offersNearby = home.profile.inNetwork && home.network.length > 0
    return (
        <>
            {active.length === 0 && offersNearby ? null : active.length === 0 ? (
                <EmptyState
                    art={<ScooterIcon size={44} />}
                    title={t.courier.empty}
                    text={t.courier.emptyText}
                />
            ) : (
                <ul className="flex flex-col gap-3" aria-label={t.courier.active}>
                    {active.map((order) => (
                        <DeliveryCard
                            key={order.id}
                            order={order}
                            onChange={replace}
                            onStale={(): void => void reload()}
                        />
                    ))}
                </ul>
            )}
            {done.length > 0 ? (
                <section>
                    <h2 className="px-1 text-sm font-semibold text-tg-subtitle">
                        {t.courier.doneToday} · {done.length}
                    </h2>
                    <ul className="divide-y divide-tg-separator">
                        {done.map((order) => (
                            <DoneRow key={order.id} order={order} />
                        ))}
                    </ul>
                </section>
            ) : null}
        </>
    )
}

/**
 * The courier's screen in the Zumda courier bot: the shift, what to deliver now across all their
 * shops, what is done today, and each shop's cash on their hands.
 */
export function CourierApp(): React.JSX.Element {
    const t = useT()
    useEffect(() => {
        setCourierBot()
        applyBrand(ZUMDA_BRAND_COLOR)
        document.title = `${ZUMDA_NAME} Kuryer`
    }, [])
    const { home, error, reload, replace, setHome } = useHome()
    useMainAction(null)

    if (error === "FORBIDDEN" && home === null) {
        return (
            <EmptyState
                art={<ScooterIcon size={44} />}
                title={t.courier.notCourierTitle}
                text={t.courier.notCourierText}
            />
        )
    }
    if (error && home === null) {
        return (
            <EmptyState
                art={<WifiOffIcon size={44} />}
                title={errorText(t, error)}
                action={
                    <Button variant="secondary" onClick={(): void => void reload()}>
                        {t.common.retry}
                    </Button>
                }
            />
        )
    }
    return (
        <main className="flex flex-col gap-4 px-4">
            <header className="pb-1 pt-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-tg-hint">
                    <ZumdaMark size={18} />
                    {ZUMDA_NAME} Kuryer
                </p>
                <h1 className="text-2xl font-bold">{t.courier.title}</h1>
            </header>
            {home === null ? (
                <Skeleton className="h-72 rounded-tile" />
            ) : (
                <>
                    <ShiftCard home={home} onChange={setHome} />
                    {/* Nothing to deliver yet: orders nearby come before the empty state. */}
                    {home.orders.some(isActive) ? null : <Nearby home={home} reload={reload} />}
                    <Deliveries home={home} replace={replace} reload={reload} />
                    {home.orders.some(isActive) ? <Nearby home={home} reload={reload} /> : null}
                    <NetworkCard home={home} onChange={setHome} />
                    <section className="flex flex-col gap-2">
                        <h2 className="px-1 text-sm font-semibold text-tg-subtitle">
                            {t.courier.shops}
                        </h2>
                        <ul className="divide-y divide-tg-separator rounded-tile bg-tg-secondary px-4">
                            {home.shops.map((shop) => (
                                <ShopRow key={shop.businessId} shop={shop} />
                            ))}
                        </ul>
                    </section>
                    <VehicleField home={home} onChange={setHome} />
                </>
            )}
            <PoweredBy />
            <BottomSpacer />
        </main>
    )
}

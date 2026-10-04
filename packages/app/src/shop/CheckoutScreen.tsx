import { Feature, formatPhone } from "@zumda/core"
import { useEffect, useRef, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api, loadCatalog } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { formatMoney, kmText } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { getLocation, haptic, requestContact, requestWriteAccess } from "../lib/telegram.js"
import { deliveryFee, summarize, useCart } from "../stores/cart.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { CardIcon, CashIcon, CheckIcon, PhoneIcon, PinIcon } from "../ui/icons.js"
import { Button, Field, Section, Stepper, TextArea, TextInput } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import type { Shop } from "../stores/session.js"
import type { PaymentMethod } from "@zumda/core"

const CONTACT_POLL_MS = 1500
const CONTACT_POLL_TRIES = 10
const LAST_ADDRESS_KEY = "zumda:address"
const CHECKOUT_PHONE = "checkout-phone"
const CHECKOUT_ADDRESS = "checkout-address"
/** How long a missing field glows after a tap on the not-yet-ready button. */
const FLASH_MS = 1400
/** A customer may hand back a few more empty bottles than they order. */
const MAX_EXTRA_BOTTLES = 5

/** The last delivery, kept on this phone: the next order starts filled in. */
interface SavedAddress {
    address: string
    landmark: string
    /** The map pin too: a network courier sees how far the order goes only with it. */
    location: Point | null
    /** A regular water customer hands back the same number of bottles each time. */
    bottlesReturned: number
}

function savedPoint(value: unknown): Point | null {
    const point = value as Partial<Point> | null | undefined
    return typeof point?.latitude === "number" && typeof point.longitude === "number"
        ? { latitude: point.latitude, longitude: point.longitude }
        : null
}

function loadAddress(): SavedAddress {
    try {
        const saved = JSON.parse(
            localStorage.getItem(LAST_ADDRESS_KEY) ?? "null",
        ) as Partial<SavedAddress> | null
        return {
            address: saved?.address ?? "",
            landmark: saved?.landmark ?? "",
            location: savedPoint(saved?.location),
            bottlesReturned: typeof saved?.bottlesReturned === "number" ? saved.bottlesReturned : 0,
        }
    } catch {
        return { address: "", landmark: "", location: null, bottlesReturned: 0 }
    }
}

function saveAddress(value: SavedAddress): void {
    try {
        localStorage.setItem(LAST_ADDRESS_KEY, JSON.stringify(value))
    } catch {
        // Not critical: the customer just types the address again next time.
    }
}

/** Phone comes from Telegram's "share contact": the bot receives it, we wait for it to land. */
function PhoneRow(): React.JSX.Element {
    const t = useT()
    const me = useSession((state) => state.me)
    const setMe = useSession((state) => state.setMe)
    const [waiting, setWaiting] = useState(false)
    const cancelled = useRef(false)
    useEffect(() => {
        // Reset on every mount: StrictMode mounts twice in development.
        cancelled.current = false
        return (): void => {
            cancelled.current = true
        }
    }, [])

    const share = async (): Promise<void> => {
        haptic.tap()
        const shared = await requestContact()
        if (!shared) {
            return
        }
        setWaiting(true)
        for (let i = 0; i < CONTACT_POLL_TRIES && !cancelled.current; i++) {
            await new Promise((resolve) => setTimeout(resolve, CONTACT_POLL_MS))
            const fresh = await api.me().catch(() => null)
            if (fresh?.phone) {
                setMe(fresh)
                haptic.success()
                break
            }
        }
        setWaiting(false)
    }

    if (me?.phone) {
        return (
            <div className="flex items-center gap-3 rounded-control bg-tg-secondary px-4 py-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-success/15 text-success">
                    <CheckIcon size={18} strokeWidth={2.25} />
                </span>
                <span className="font-medium tabular-nums">{formatPhone(me.phone)}</span>
            </div>
        )
    }
    return (
        <Button
            variant="secondary"
            size="lg"
            className="w-full"
            icon={<PhoneIcon size={20} />}
            loading={waiting}
            onClick={(): void => void share()}
        >
            {waiting ? t.checkout.phoneWaiting : t.checkout.sharePhone}
        </Button>
    )
}

type Point = { latitude: number; longitude: number }

interface Delivery {
    address: string
    landmark: string
    comment: string
    location: Point | null
    /** Empty returnable bottles handed back (water shops). */
    bottlesReturned: number
}

/** A shop that delivers within a radius takes orders only with the pin (`LOCATION_REQUIRED`). */
function needsPin(shop: Shop | null): boolean {
    return shop?.delivery.radiusMeters !== undefined
}

function AddressSection({
    value,
    onChange,
}: {
    value: Delivery
    onChange(change: Partial<Delivery>): void
}): React.JSX.Element {
    const t = useT()
    const shop = useSession((state) => state.shop)
    const radius = shop?.delivery.radiusMeters
    const locate = async (): Promise<void> => {
        haptic.tap()
        const found = await getLocation()
        if (found) {
            onChange({ location: { latitude: found.latitude, longitude: found.longitude } })
            haptic.success()
        } else {
            toast(t.checkout.locationFailed, "error")
        }
    }
    return (
        <Section title={t.checkout.address} id={CHECKOUT_ADDRESS}>
            {/* The pin first: one tap, and the courier finds the door even without words. */}
            <LocationButton saved={value.location !== null} onLocate={(): void => void locate()} />
            <p className="-mt-1 px-1 text-sm text-tg-hint">
                {radius === undefined
                    ? t.checkout.pinHelps
                    : fill(t.checkout.pinRequired, { km: kmText(radius) })}
            </p>
            <Field
                label={t.checkout.street}
                htmlFor="street"
                hint={value.location ? t.checkout.streetOrLandmark : undefined}
            >
                <TextInput
                    id="street"
                    aria-label={t.checkout.address}
                    value={value.address}
                    onChange={(e): void => onChange({ address: e.target.value })}
                    placeholder={t.checkout.addressPlaceholder}
                    maxLength={200}
                    autoComplete="street-address"
                />
            </Field>
            <Field label={`${t.checkout.landmark} (${t.checkout.optional})`} htmlFor="landmark">
                <TextInput
                    id="landmark"
                    value={value.landmark}
                    onChange={(e): void => onChange({ landmark: e.target.value })}
                    placeholder={t.checkout.landmarkPlaceholder}
                    maxLength={200}
                />
            </Field>
        </Section>
    )
}

function LocationButton({
    saved,
    onLocate,
}: {
    saved: boolean
    onLocate(): void
}): React.JSX.Element {
    const t = useT()
    return (
        <button
            type="button"
            onClick={onLocate}
            className={cn(
                "tap flex h-12 items-center justify-center gap-2 rounded-control font-medium text-tg-text transition-colors duration-200",
                saved ? "bg-success/15" : "bg-tg-secondary",
            )}
        >
            {saved ? (
                <CheckIcon size={20} className="text-success" />
            ) : (
                <PinIcon size={20} className="text-brand" />
            )}
            {saved ? t.checkout.locationSaved : t.checkout.shareLocation}
        </button>
    )
}

/** Sends the order: prices and totals are computed by the Worker, the app sends only ids. */
function usePlaceOrder(
    delivery: Delivery,
    paymentMethod: PaymentMethod | undefined,
): { placing: boolean; place(): Promise<void> } {
    const t = useT()
    const catalog = useSession((state) => state.catalog)
    const setCatalog = useSession((state) => state.setCatalog)
    const lines = useCart((state) => state.lines)
    const clearCart = useCart((state) => state.clear)
    const reset = useRouter((state) => state.reset)
    const [placing, setPlacing] = useState(false)

    const place = async (): Promise<void> => {
        setPlacing(true)
        try {
            await requestWriteAccess()
            const order = await api.placeOrder({
                items: summarize(lines, catalog).lines.map((l) => ({
                    productId: l.product.id,
                    quantity: l.quantity,
                })),
                // A pin and a landmark are an address in a mahalla: the landmark stands in.
                address: delivery.address.trim() || delivery.landmark.trim(),
                landmark: delivery.address.trim()
                    ? delivery.landmark.trim() || undefined
                    : undefined,
                location: delivery.location ?? undefined,
                comment: delivery.comment.trim() || undefined,
                bottlesReturned: delivery.bottlesReturned || undefined,
                paymentMethod,
            })
            saveAddress({
                address: delivery.address.trim(),
                landmark: delivery.landmark.trim(),
                location: delivery.location,
                // An order without bottles keeps the count a water order left.
                bottlesReturned: delivery.bottlesReturned || loadAddress().bottlesReturned,
            })
            clearCart()
            haptic.success()
            reset({ name: "order", id: order.id, justPlaced: true })
        } catch (error) {
            haptic.error()
            const code = error instanceof ApiError ? error.code : "generic"
            toast(errorText(t, code), "error")
            if (code === "PRODUCT_NOT_AVAILABLE") {
                loadCatalog()
                    .then((products) => {
                        setCatalog(products)
                        useCart.getState().prune(products.map((p) => p.id))
                    })
                    .catch(() => undefined)
            }
        } finally {
            setPlacing(false)
        }
    }
    return { placing, place }
}

/** Water shops: how many empty bottles go back; kept bottles carry the shop's deposit. */
function BottlesField({
    returnable,
    value,
    onChange,
}: {
    returnable: number
    value: number
    onChange(value: number): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const deposit = useSession((state) => state.shop?.bottleDeposit ?? 0)
    return (
        <Section title={t.checkout.bottles}>
            {/* The question on top, the answer under it: the long hint never squeezes the stepper. */}
            <div className="flex flex-col items-start gap-3 rounded-control bg-tg-secondary px-4 py-3">
                <p className="text-sm text-tg-subtitle">
                    {fill(t.checkout.bottlesHint, { sum: formatMoney(deposit, language) })}
                </p>
                <Stepper
                    quantity={value}
                    onAdd={(): void =>
                        onChange(Math.min(value + 1, returnable + MAX_EXTRA_BOTTLES))
                    }
                    onRemove={(): void => onChange(Math.max(value - 1, 0))}
                    label={t.checkout.bottles}
                />
            </div>
        </Section>
    )
}

/** One way of paying, as a row to pick when the shop takes both. */
function MethodRow({
    method,
    selected,
    total,
    onChoose,
}: {
    method: PaymentMethod
    selected: boolean
    total: number
    onChoose(): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const sum = formatMoney(total, language)
    const cash = method === "cash"
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={(): void => {
                haptic.select()
                onChoose()
            }}
            className={cn(
                "tap flex min-h-[64px] items-center gap-3 rounded-tile p-4 text-left ring-2 transition-colors duration-200",
                selected ? "bg-brand/10 ring-brand" : "bg-tg-secondary ring-transparent",
            )}
        >
            <span className={selected ? "text-brand" : "text-tg-hint"}>
                {cash ? <CashIcon size={22} /> : <CardIcon size={22} />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-semibold">{cash ? t.pay.cashChoice : t.pay.card}</span>
                <span className="block text-sm text-tg-subtitle">
                    {fill(cash ? t.pay.cashToCourier : t.pay.afterOrder, { sum })}
                </span>
            </span>
            <span
                className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200",
                    selected ? "border-brand bg-brand text-brand-ink" : "border-tg-separator",
                )}
            >
                {selected ? <CheckIcon size={14} strokeWidth={3} /> : null}
            </span>
        </button>
    )
}

/**
 * How the customer pays: a transfer to the shop's card after placing (the shop starts once the
 * money arrives), or cash to the courier at the door. A shop that takes both lets the customer
 * pick; the card number waits for the order screen.
 */
function PaymentSection({
    total,
    methods,
    method,
    onChoose,
}: {
    total: number
    methods: readonly PaymentMethod[]
    method: PaymentMethod | undefined
    onChoose(method: PaymentMethod): void
}): React.JSX.Element | null {
    const t = useT()
    const language = useLanguage()
    if (!method) {
        return null
    }
    if (methods.length > 1) {
        return (
            <Section title={t.pay.methodTitle}>
                <div
                    role="radiogroup"
                    aria-label={t.pay.methodTitle}
                    className="flex flex-col gap-2"
                >
                    {methods.map((m) => (
                        <MethodRow
                            key={m}
                            method={m}
                            selected={m === method}
                            total={total}
                            onChoose={(): void => onChoose(m)}
                        />
                    ))}
                </div>
                <p className="px-1 text-sm text-tg-hint">
                    {method === "cash" ? t.pay.cashHint : t.pay.afterOrderHint}
                </p>
            </Section>
        )
    }
    const cash = method === "cash"
    return (
        <Section title={cash ? t.pay.cashTitle : t.pay.title}>
            <div className="flex gap-3 rounded-tile bg-tg-secondary p-4">
                {cash ? (
                    <CashIcon size={22} className="mt-0.5 shrink-0 text-brand" />
                ) : (
                    <CardIcon size={22} className="mt-0.5 shrink-0 text-brand" />
                )}
                <div>
                    <p className="font-semibold">
                        {fill(cash ? t.pay.cashToCourier : t.pay.afterOrder, {
                            sum: formatMoney(total, language),
                        })}
                    </p>
                    <p className="mt-1 text-sm text-tg-subtitle">
                        {cash ? t.pay.cashHint : t.pay.afterOrderHint}
                    </p>
                </div>
            </div>
        </Section>
    )
}

function Totals({ rows }: { rows: [string, number | string, boolean?][] }): React.JSX.Element {
    const language = useLanguage()
    return (
        <div className="flex flex-col gap-2 rounded-tile bg-tg-secondary p-4">
            {rows.map(([label, value, strong]) => (
                <div
                    key={label}
                    className={
                        strong
                            ? "flex justify-between text-lg font-bold"
                            : "flex justify-between text-tg-subtitle"
                    }
                >
                    <span>{label}</span>
                    <span className="tabular-nums">
                        {typeof value === "number" ? formatMoney(value, language) : value}
                    </span>
                </div>
            ))}
        </div>
    )
}

/** What still stops the order, first thing first: the place to show and the words to say. */
function missingStep(
    t: ReturnType<typeof useT>,
    input: {
        phone: string | undefined
        hasCard: boolean
        address: string
        count: number
        /** The shop delivers within a radius: it needs the pin to tell. */
        needsPin: boolean
        hasPin: boolean
        landmark: string
    },
): { id: string | null; text: string } | null {
    if (input.count === 0) {
        return { id: null, text: t.cart.emptyText }
    }
    if (!input.hasCard) {
        return { id: null, text: errorText(t, "NO_PAYOUT_CARD") }
    }
    if (!input.phone) {
        return { id: CHECKOUT_PHONE, text: t.checkout.needPhone }
    }
    if (input.needsPin && !input.hasPin) {
        return { id: CHECKOUT_ADDRESS, text: t.checkout.needPin }
    }
    // With the pin, a landmark is enough: many district homes have no street and number.
    const placeNamed = input.address.trim() || (input.hasPin && input.landmark.trim())
    if (!placeNamed) {
        return {
            id: CHECKOUT_ADDRESS,
            text: input.hasPin ? t.checkout.needStreetOrLandmark : t.checkout.needAddress,
        }
    }
    return null
}

/**
 * The main button: never dead. A tap before everything is there says what is missing, scrolls
 * to it and makes it glow for a moment. Returns the glow class for a section by its id.
 */
function useOrderButton(input: {
    missing: { id: string | null; text: string } | null
    placing: boolean
    place(): Promise<void>
    text: string
}): (id: string) => string {
    const { missing, placing, place, text } = input
    const [flash, setFlash] = useState<string | null>(null)
    useEffect(() => {
        if (!flash) {
            return undefined
        }
        const timer = window.setTimeout(() => setFlash(null), FLASH_MS)
        return (): void => window.clearTimeout(timer)
    }, [flash])

    useMainAction({
        text,
        onClick: (): void => {
            if (placing) {
                return
            }
            if (!missing) {
                void place()
                return
            }
            haptic.error()
            toast(missing.text, "error")
            if (missing.id) {
                document
                    .getElementById(missing.id)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                setFlash(missing.id)
            }
        },
        loading: placing,
    })
    return (id: string): string =>
        cn(
            "rounded-tile transition-shadow duration-300",
            flash === id &&
                "shadow-[0_0_0_3px_color-mix(in_srgb,var(--ui-destructive)_35%,transparent)]",
        )
}

/** Bottles for a water order: the remembered count only where bottles go back, and never past
 * what this order allows; the deposit for the ones the customer keeps. */
function bottlesOf(
    shop: Shop | null,
    returnable: number,
    remembered: number,
): { usesBottles: boolean; bottlesReturned: number; deposit: number } {
    const usesBottles = Boolean(shop?.features.includes(Feature.BOTTLE_DEPOSIT)) && returnable > 0
    if (!usesBottles) {
        return { usesBottles, bottlesReturned: 0, deposit: 0 }
    }
    const bottlesReturned = Math.min(remembered, returnable + MAX_EXTRA_BOTTLES)
    const deposit = (shop?.bottleDeposit ?? 0) * Math.max(0, returnable - bottlesReturned)
    return { usesBottles, bottlesReturned, deposit }
}

/** The customer's pick while the shop still takes it; else the first way it takes (the card). */
function usePaymentMethod(shop: Shop | null): {
    methods: readonly PaymentMethod[]
    method: PaymentMethod | undefined
    setChosen(method: PaymentMethod): void
} {
    const methods = shop?.paymentMethods ?? []
    const [chosen, setChosen] = useState<PaymentMethod | null>(null)
    const method = chosen && methods.includes(chosen) ? chosen : methods[0]
    return { methods, method, setChosen }
}

export function CheckoutScreen(): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const shop = useSession((state) => state.shop)
    const catalog = useSession((state) => state.catalog)
    const me = useSession((state) => state.me)
    const lines = useCart((state) => state.lines)
    const [delivery, setDelivery] = useState<Delivery>(() => ({
        ...loadAddress(),
        comment: "",
    }))
    const cart = summarize(lines, catalog)
    const fee = deliveryFee(cart.subtotal, shop?.delivery ?? { fee: 0 })
    const { usesBottles, bottlesReturned, deposit } = bottlesOf(
        shop,
        cart.returnable,
        delivery.bottlesReturned,
    )
    const { methods, method, setChosen } = usePaymentMethod(shop)
    const { placing, place } = usePlaceOrder({ ...delivery, bottlesReturned }, method)
    const total = cart.subtotal + fee + deposit
    const missing = missingStep(t, {
        phone: me?.phone,
        // Waiting for Zumda's approval: the storefront opens, orders do not yet.
        hasCard: (shop?.paymentMethods.length ?? 0) > 0 && !shop?.opensSoon,
        address: delivery.address,
        count: cart.count,
        needsPin: needsPin(shop),
        hasPin: delivery.location !== null,
        landmark: delivery.landmark,
    })
    const glow = useOrderButton({
        missing,
        placing,
        place,
        text: placing
            ? t.checkout.placing
            : `${t.checkout.place} · ${formatMoney(total, language)}`,
    })

    return (
        <main className="flex flex-col gap-6 px-4 pt-4">
            {/* How paying works is said once, next to the total, where the decision is made. */}
            <h1 className="text-2xl font-bold">{t.checkout.title}</h1>

            <Section title={t.checkout.phone} id={CHECKOUT_PHONE} className={glow(CHECKOUT_PHONE)}>
                <PhoneRow />
                <p className="px-1 text-sm text-tg-hint">{t.checkout.phoneHint}</p>
            </Section>

            <div className={glow(CHECKOUT_ADDRESS)}>
                <AddressSection
                    value={delivery}
                    onChange={(change): void => setDelivery((d) => ({ ...d, ...change }))}
                />
            </div>

            {usesBottles ? (
                <BottlesField
                    returnable={cart.returnable}
                    value={bottlesReturned}
                    onChange={(bottlesReturned): void =>
                        setDelivery((d) => ({ ...d, bottlesReturned }))
                    }
                />
            ) : null}

            <Field label={`${t.checkout.comment} (${t.checkout.optional})`} htmlFor="comment">
                <TextArea
                    id="comment"
                    value={delivery.comment}
                    onChange={(e): void => setDelivery((d) => ({ ...d, comment: e.target.value }))}
                    placeholder={t.checkout.commentPlaceholder}
                    maxLength={300}
                />
            </Field>

            <Totals
                rows={[
                    [t.cart.subtotal, cart.subtotal],
                    [t.cart.delivery, fee === 0 ? t.common.free : fee],
                    ...(deposit > 0 ? [[t.cart.deposit, deposit] as [string, number]] : []),
                    [t.cart.total, total, true],
                ]}
            />

            <PaymentSection total={total} methods={methods} method={method} onChoose={setChosen} />
            <BottomSpacer />
        </main>
    )
}

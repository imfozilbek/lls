import { Feature, formatPhone } from "@zumda/core"
import { useEffect, useRef, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api, loadCatalog } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { formatMoney } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { getLocation, haptic, requestContact, requestWriteAccess } from "../lib/telegram.js"
import { deliveryFee, summarize, useCart } from "../stores/cart.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { CardIcon, CheckIcon, PhoneIcon, PinIcon } from "../ui/icons.js"
import { Button, Field, Section, Stepper, TextArea, TextInput } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

const CONTACT_POLL_MS = 1500
const CONTACT_POLL_TRIES = 10
const LAST_ADDRESS_KEY = "zumda:address"
const CHECKOUT_PHONE = "checkout-phone"
const CHECKOUT_ADDRESS = "checkout-address"
/** How long a missing field glows after a tap on the not-yet-ready button. */
const FLASH_MS = 1400
/** A customer may hand back a few more empty bottles than they order. */
const MAX_EXTRA_BOTTLES = 5

interface SavedAddress {
    address: string
    landmark: string
}

function loadAddress(): SavedAddress {
    try {
        const saved = JSON.parse(
            localStorage.getItem(LAST_ADDRESS_KEY) ?? "null",
        ) as SavedAddress | null
        return { address: saved?.address ?? "", landmark: saved?.landmark ?? "" }
    } catch {
        return { address: "", landmark: "" }
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

function AddressSection({
    value,
    onChange,
}: {
    value: Delivery
    onChange(change: Partial<Delivery>): void
}): React.JSX.Element {
    const t = useT()
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
            <Field label={t.checkout.street} htmlFor="street">
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
function usePlaceOrder(delivery: Delivery): { placing: boolean; place(): Promise<void> } {
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
                address: delivery.address.trim(),
                landmark: delivery.landmark.trim() || undefined,
                location: delivery.location ?? undefined,
                comment: delivery.comment.trim() || undefined,
                bottlesReturned: delivery.bottlesReturned || undefined,
            })
            saveAddress({ address: delivery.address.trim(), landmark: delivery.landmark.trim() })
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

/**
 * Only a transfer to the shop's card, made after placing: the shop starts once the money
 * arrives. The card number waits for the order screen; here the customer learns how and how much.
 */
function PaymentSection({ total }: { total: number }): React.JSX.Element | null {
    const t = useT()
    const language = useLanguage()
    const card = useSession((state) => state.shop?.payoutCard)
    if (!card) {
        return null
    }
    return (
        <Section title={t.pay.title}>
            <div className="flex gap-3 rounded-tile bg-tg-secondary p-4">
                <CardIcon size={22} className="mt-0.5 shrink-0 text-brand" />
                <div>
                    <p className="font-semibold">
                        {fill(t.pay.afterOrder, { sum: formatMoney(total, language) })}
                    </p>
                    <p className="mt-1 text-sm text-tg-subtitle">{t.pay.afterOrderHint}</p>
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
    input: { phone: string | undefined; hasCard: boolean; address: string; count: number },
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
    if (input.address.trim().length === 0) {
        return { id: CHECKOUT_ADDRESS, text: t.checkout.needAddress }
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
        location: null,
        bottlesReturned: 0,
    }))
    const { placing, place } = usePlaceOrder(delivery)

    const cart = summarize(lines, catalog)
    const fee = deliveryFee(cart.subtotal, shop?.delivery ?? { fee: 0 })
    const usesBottles =
        Boolean(shop?.features.includes(Feature.BOTTLE_DEPOSIT)) && cart.returnable > 0
    const deposit = usesBottles
        ? (shop?.bottleDeposit ?? 0) * Math.max(0, cart.returnable - delivery.bottlesReturned)
        : 0
    const total = cart.subtotal + fee + deposit
    const missing = missingStep(t, {
        phone: me?.phone,
        // Waiting for Zumda's approval: the storefront opens, orders do not yet.
        hasCard: shop?.hasPayoutCard === true && !shop.opensSoon,
        address: delivery.address,
        count: cart.count,
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
            <div>
                <h1 className="text-2xl font-bold">{t.checkout.title}</h1>
                {/* How paying works, before anything is filled in: never a surprise at the end. */}
                <p className="mt-1 flex items-center gap-2 text-sm text-tg-subtitle">
                    <CardIcon size={16} className="shrink-0 text-brand" />
                    {t.pay.howItWorks}
                </p>
            </div>

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

            <Field label={`${t.checkout.comment} (${t.checkout.optional})`} htmlFor="comment">
                <TextArea
                    id="comment"
                    value={delivery.comment}
                    onChange={(e): void => setDelivery((d) => ({ ...d, comment: e.target.value }))}
                    placeholder={t.checkout.commentPlaceholder}
                    maxLength={300}
                />
            </Field>

            {usesBottles ? (
                <BottlesField
                    returnable={cart.returnable}
                    value={delivery.bottlesReturned}
                    onChange={(bottlesReturned): void =>
                        setDelivery((d) => ({ ...d, bottlesReturned }))
                    }
                />
            ) : null}

            <Totals
                rows={[
                    [t.cart.subtotal, cart.subtotal],
                    [t.cart.delivery, fee === 0 ? t.common.free : fee],
                    ...(deposit > 0 ? [[t.cart.deposit, deposit] as [string, number]] : []),
                    [t.cart.total, total, true],
                ]}
            />

            <PaymentSection total={total} />
            <BottomSpacer />
        </main>
    )
}

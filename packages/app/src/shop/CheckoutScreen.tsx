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
import { CheckIcon, PhoneIcon, PinIcon } from "../ui/icons.js"
import { CardBlock } from "../ui/payment.js"
import { Button, Field, Section, Stepper, TextArea, TextInput } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

const CONTACT_POLL_MS = 1500
const CONTACT_POLL_TRIES = 10
const LAST_ADDRESS_KEY = "zumda:address"
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
        <Section title={t.checkout.address}>
            <TextInput
                aria-label={t.checkout.address}
                value={value.address}
                onChange={(e): void => onChange({ address: e.target.value })}
                placeholder={t.checkout.addressPlaceholder}
                maxLength={200}
                autoComplete="street-address"
            />
            <Field label={t.checkout.landmark} htmlFor="landmark">
                <TextInput
                    id="landmark"
                    value={value.landmark}
                    onChange={(e): void => onChange({ landmark: e.target.value })}
                    placeholder={t.checkout.landmarkPlaceholder}
                    maxLength={200}
                />
            </Field>
            <button
                type="button"
                onClick={(): void => void locate()}
                className={cn(
                    "tap flex h-12 items-center justify-center gap-2 rounded-control font-medium text-tg-text transition-colors duration-200",
                    value.location ? "bg-success/15" : "bg-brand/10",
                )}
            >
                {value.location ? (
                    <CheckIcon size={20} className="text-success" />
                ) : (
                    <PinIcon size={20} className="text-brand" />
                )}
                {value.location ? t.checkout.locationSaved : t.checkout.shareLocation}
            </button>
        </Section>
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
            <div className="flex items-center justify-between gap-3 rounded-control bg-tg-secondary px-4 py-3">
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
 * arrives. The card is shown here so the customer knows before tapping «Заказать».
 */
function PaymentSection({ total }: { total: number }): React.JSX.Element | null {
    const t = useT()
    const card = useSession((state) => state.shop?.payoutCard)
    if (!card) {
        return null
    }
    return (
        <Section title={t.pay.title}>
            <p className="px-1 text-sm text-tg-subtitle">{t.pay.beforeCooking}</p>
            <CardBlock card={card} total={total} />
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

/** A phone, an address, something in the cart, and a shop card to transfer to. */
function canPlace(input: {
    phone: string | undefined
    hasCard: boolean | undefined
    address: string
    count: number
}): boolean {
    return (
        Boolean(input.phone) &&
        Boolean(input.hasCard) &&
        input.address.trim().length > 0 &&
        input.count > 0
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
    const ready = canPlace({
        phone: me?.phone,
        // Waiting for Zumda's approval: the storefront opens, orders do not yet.
        hasCard: shop?.hasPayoutCard === true && !shop.opensSoon,
        address: delivery.address,
        count: cart.count,
    })

    useMainAction({
        text: placing
            ? t.checkout.placing
            : `${t.checkout.place} · ${formatMoney(total, language)}`,
        onClick: (): void => {
            if (ready && !placing) {
                void place()
            }
        },
        loading: placing,
        disabled: !ready,
    })

    return (
        <main className="flex flex-col gap-6 px-4 pt-4">
            <h1 className="text-2xl font-bold">{t.checkout.title}</h1>

            <Section title={t.checkout.phone}>
                <PhoneRow />
                <p className="px-1 text-sm text-tg-hint">{t.checkout.phoneHint}</p>
            </Section>

            <AddressSection
                value={delivery}
                onChange={(change): void => setDelivery((d) => ({ ...d, ...change }))}
            />

            <Field label={t.checkout.comment} htmlFor="comment">
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

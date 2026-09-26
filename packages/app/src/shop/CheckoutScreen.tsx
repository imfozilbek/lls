import { useEffect, useRef, useState } from "react"

import { errorText, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { formatMoney } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { getLocation, haptic, requestContact, requestWriteAccess } from "../lib/telegram.js"
import { deliveryFee, summarize, useCart } from "../stores/cart.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { CheckIcon, PhoneIcon, PinIcon } from "../ui/icons.js"
import { Button, Field, Section, TextArea, TextInput } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

const CONTACT_POLL_MS = 1500
const CONTACT_POLL_TRIES = 10
const LAST_ADDRESS_KEY = "lls:address"

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

function formatPhone(phone: string): string {
    if (phone.startsWith("+998") && phone.length === 13) {
        const d = phone.slice(4)
        return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`
    }
    return phone
}

/** Phone comes from Telegram's "share contact": the bot receives it, we wait for it to land. */
function PhoneRow(): React.JSX.Element {
    const t = useT()
    const me = useSession((state) => state.me)
    const setMe = useSession((state) => state.setMe)
    const [waiting, setWaiting] = useState(false)
    const cancelled = useRef(false)
    useEffect(
        () => (): void => {
            cancelled.current = true
        },
        [],
    )

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
                api.products()
                    .then((page) => setCatalog(page.data))
                    .catch(() => undefined)
            }
        } finally {
            setPlacing(false)
        }
    }
    return { placing, place }
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
    }))
    const { placing, place } = usePlaceOrder(delivery)

    const cart = summarize(lines, catalog)
    const total = cart.subtotal + deliveryFee(cart.subtotal, shop?.delivery ?? { fee: 0 })
    const ready = Boolean(me?.phone) && delivery.address.trim().length > 0 && cart.count > 0

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

            <p className="rounded-control bg-tg-secondary px-4 py-3 text-sm text-tg-subtitle">
                {t.checkout.payment}
            </p>
            <BottomSpacer />
        </main>
    )
}

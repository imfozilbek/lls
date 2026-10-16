import { Feature, formatPhone } from "@zumda/core"
import { useEffect, useRef, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import {
    clearDraft,
    loadAddress,
    loadDraft,
    saveAddress,
    saveDraft,
    saveShowcaseOrder,
} from "../lib/address-book.js"
import { ApiError, api, currentShopVia, loadCatalog, scopedKey } from "../lib/api.js"
import { remember } from "../lib/cache.js"
import { cn } from "../lib/cn.js"
import { formatMoney, kmText } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { removedText } from "../lib/removed.js"
import { takesOrdersNow } from "../lib/shop-ready.js"
import { canRequestContact, haptic, requestContact, requestWriteAccess } from "../lib/telegram.js"
import { deliveryFee, summarize, useCart } from "../stores/cart.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { BagIcon, CardIcon, CashIcon, CheckIcon, PhoneIcon } from "../ui/icons.js"
import { Button, EmptyState, Field, Section, Stepper, TextArea } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import { CartLines, closedText } from "./cart-lines.js"
import {
    AddressSection,
    AddressSummary,
    CHECKOUT_ADDRESS,
    addressComplete,
    needsPin,
    outsideZone,
} from "./checkout-address.js"

import type { Delivery } from "./checkout-address.js"
import type { Dictionary } from "../i18n/index.js"
import type { DeliveryRules } from "../stores/cart.js"
import type { Shop } from "../stores/session.js"
import type { Language, PaymentMethod, ProductDTO } from "@zumda/core"

const CONTACT_POLL_MS = 1500
const CONTACT_POLL_TRIES = 10
const CHECKOUT_PHONE = "checkout-phone"
/** How long a missing field glows after a tap on the not-yet-ready button. */
const FLASH_MS = 1400
/** A customer may hand back a few more empty bottles than they order. */
const MAX_EXTRA_BOTTLES = 5

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
        if (!canRequestContact()) {
            toast(t.checkout.phoneUpdateTelegram, "error")
            return
        }
        const shared = await requestContact()
        if (!shared) {
            return
        }
        setWaiting(true)
        let arrived = false
        for (let i = 0; i < CONTACT_POLL_TRIES && !cancelled.current; i++) {
            await new Promise((resolve) => setTimeout(resolve, CONTACT_POLL_MS))
            const fresh = await api.me().catch(() => null)
            if (fresh?.phone) {
                setMe(fresh)
                haptic.success()
                arrived = true
                break
            }
        }
        setWaiting(false)
        if (!arrived && !cancelled.current) {
            toast(t.checkout.phoneNotArrived, "error")
        }
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

/** Codes that mean the cart or the shop changed under the customer: what they see is reloaded. */
const CATALOG_CHANGED = new Set([
    "PRODUCT_NOT_AVAILABLE",
    "OPTION_UNAVAILABLE",
    "ENTITY_NOT_FOUND",
    "VALIDATION_ERROR",
])

/**
 * After a refusal: the catalog (the cart loses what is gone, by name: the total on the button
 * changes, and the customer sees why) or the shop's ways of paying are read again.
 */
function refreshAfterRefusal(code: string, t: Dictionary): void {
    if (CATALOG_CHANGED.has(code)) {
        const seen = useSession.getState().catalog
        loadCatalog()
            .then((products: ProductDTO[]) => {
                useSession.getState().setCatalog(products)
                const removed = useCart.getState().prune(products)
                if (removed.length > 0) {
                    toast(removedText(t, removed, seen), "error")
                }
            })
            .catch(() => undefined)
    }
    if (code === "PAYMENT_METHOD_UNAVAILABLE") {
        // The owner changed «To'lov»: the shop's ways of paying are read again.
        api.shop()
            .then((shop) => useSession.getState().setShop(shop))
            .catch(() => undefined)
    }
}

/** At checkout «not found» is a product that left the shop, not a list to refresh. */
function refusalText(t: Dictionary, code: string): string {
    return code === "ENTITY_NOT_FOUND" ? t.checkout.itemGone : errorText(t, code)
}

/** Sends the order: prices and totals are computed by the Worker, the app sends only ids. */
function usePlaceOrder(
    delivery: Delivery,
    paymentMethod: PaymentMethod | undefined,
): { placing: boolean; place(): Promise<void> } {
    const t = useT()
    const catalog = useSession((state) => state.catalog)
    const shopSlug = useSession((state) => state.shop?.slug)
    const lines = useCart((state) => state.lines)
    const clearCart = useCart((state) => state.clear)
    const reset = useRouter((state) => state.reset)
    const [placing, setPlacing] = useState(false)
    // The cart's id: a tap again after a lost answer, even after leaving and coming back, gets
    // the order already placed.
    const checkoutId = useCart((state) => state.checkoutId)
    // Two taps of Telegram's button before a render would both see `placing` false.
    const inFlight = useRef(false)

    const place = async (): Promise<void> => {
        if (inFlight.current) {
            return
        }
        inFlight.current = true
        setPlacing(true)
        try {
            await requestWriteAccess()
            const order = await api.placeOrder({
                items: summarize(lines, catalog).lines.map((l) => ({
                    productId: l.product.id,
                    quantity: l.quantity,
                    ...(l.pick?.variantId ? { variantId: l.pick.variantId } : {}),
                    ...(l.pick?.addonIds.length ? { addonIds: l.pick.addonIds } : {}),
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
                clientOrderId: checkoutId,
            })
            saveAddress({
                address: delivery.address.trim(),
                landmark: delivery.landmark.trim(),
                location: delivery.location,
                // An order without bottles keeps the count a water order left.
                bottlesReturned: delivery.bottlesReturned || loadAddress().bottlesReturned,
                paymentMethod,
            })
            if (shopSlug) {
                clearDraft(shopSlug)
                // Zumda | Shop leads back to it: the customer may not remember the shop.
                if (currentShopVia() === "marketplace") {
                    saveShowcaseOrder({
                        slug: shopSlug,
                        shopName: useSession.getState().shop?.name ?? "",
                        id: order.id,
                        number: order.number,
                        at: Date.now(),
                    })
                }
            }
            // The order screen paints at once from it: the card number is there without a wait.
            remember(`state:${scopedKey(`order:${order.id}`)}`, order)
            clearCart()
            haptic.success()
            reset({ name: "order", id: order.id, justPlaced: true })
        } catch (error) {
            haptic.error()
            const code = error instanceof ApiError ? error.code : "generic"
            toast(refusalText(t, code), "error")
            refreshAfterRefusal(code, t)
        } finally {
            inFlight.current = false
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

interface Missing {
    id: string | null
    text: string
}

/** The shop side first: nothing the customer fills in can make a closed shop take the order. */
function shopStep(
    t: Dictionary,
    input: { shop: Shop | null; subtotal: number; rules: DeliveryRules; language: Language },
): Missing | null {
    const closed = closedText(t, input.shop)
    if (closed) {
        return { id: null, text: closed }
    }
    const { minOrder } = input.rules
    if (minOrder !== undefined && input.subtotal < minOrder) {
        return {
            id: null,
            text: fill(t.cart.minOrderLeft, {
                sum: formatMoney(minOrder - input.subtotal, input.language),
            }),
        }
    }
    return null
}

/** What still stops the order, first thing first: the place to show and the words to say. */
function customerStep(
    t: Dictionary,
    input: { phone: string | undefined; delivery: Delivery; shop: Shop | null },
): Missing | null {
    const { delivery, shop } = input
    if (!input.phone) {
        return { id: CHECKOUT_PHONE, text: t.checkout.needPhone }
    }
    const hasPin = delivery.location !== null
    if (needsPin(shop) && !hasPin) {
        return { id: CHECKOUT_ADDRESS, text: t.checkout.needPin }
    }
    const radius = shop?.delivery.radiusMeters
    if (radius !== undefined && outsideZone(shop, delivery.location)) {
        return {
            id: CHECKOUT_ADDRESS,
            text: fill(t.map.outsideZone, { km: kmText(radius) }),
        }
    }
    // With the pin, a landmark is enough: many district homes have no street and number.
    const placeNamed = delivery.address.trim() || (hasPin && delivery.landmark.trim())
    if (!placeNamed) {
        return {
            id: CHECKOUT_ADDRESS,
            text: hasPin ? t.checkout.needStreetOrLandmark : t.checkout.needAddress,
        }
    }
    return null
}

/**
 * The main button: never dead. A tap before everything is there says what is missing, scrolls
 * to it and makes it glow for a moment. Returns the glow class for a section by its id.
 */
function useOrderButton(input: {
    missing: Missing | null
    placing: boolean
    place(): Promise<void>
    text: string | null
    /** A section is about to be shown (the address folded in one line). */
    onReveal(id: string): void
}): (id: string) => string {
    const { missing, placing, place, text, onReveal } = input
    const setMe = useSession((state) => state.setMe)
    const [flash, setFlash] = useState<string | null>(null)
    useEffect(() => {
        if (!flash) {
            return undefined
        }
        const timer = window.setTimeout(() => setFlash(null), FLASH_MS)
        return (): void => window.clearTimeout(timer)
    }, [flash])

    const tell = (step: Missing): void => {
        haptic.error()
        toast(step.text, "error")
        if (step.id) {
            const id = step.id
            onReveal(id)
            window.setTimeout(() => {
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" })
            }, 0)
            setFlash(id)
        }
    }
    // The contact goes to the bot, not the app: it may have arrived after the row gave up
    // waiting. One quick look before saying it is missing.
    const phoneThenTell = async (step: Missing): Promise<void> => {
        const fresh = await api.me().catch(() => null)
        if (fresh?.phone) {
            setMe(fresh)
            haptic.success()
            return
        }
        tell(step)
    }

    useMainAction(
        text === null
            ? null
            : {
                  text,
                  onClick: (): void => {
                      if (placing) {
                          return
                      }
                      if (!missing) {
                          void place()
                          return
                      }
                      if (missing.id === CHECKOUT_PHONE) {
                          void phoneThenTell(missing)
                          return
                      }
                      tell(missing)
                  },
                  loading: placing,
              },
    )
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

/**
 * The customer's pick while the shop still takes it; else how they paid last time, if the shop
 * takes that; else the first way it takes (the card).
 */
function usePaymentMethod(shop: Shop | null): {
    methods: readonly PaymentMethod[]
    method: PaymentMethod | undefined
    setChosen(method: PaymentMethod): void
} {
    const methods = shop?.paymentMethods ?? []
    const [chosen, setChosen] = useState<PaymentMethod | null>(
        () => loadAddress().paymentMethod ?? null,
    )
    const method = chosen && methods.includes(chosen) ? chosen : methods[0]
    return { methods, method, setChosen }
}

/**
 * What the customer fills in, kept on this phone on every change (per shop): «Back» to the menu
 * for one more item, or the app closed by mistake, loses nothing. A first visit starts from the
 * last delivery.
 */
function useDraft(shop: Shop | null): [Delivery, (change: Partial<Delivery>) => void] {
    const slug = shop?.slug
    const [delivery, setDelivery] = useState<Delivery>(() => {
        const draft = slug ? loadDraft(slug) : null
        if (draft) {
            return draft
        }
        const { address, landmark, location, bottlesReturned } = loadAddress()
        return { address, landmark, location, bottlesReturned, comment: "" }
    })
    useEffect(() => {
        if (slug) {
            saveDraft(slug, delivery)
        }
    }, [slug, delivery])
    return [delivery, (change): void => setDelivery((d) => ({ ...d, ...change }))]
}

/** «Buyurtma berish · Naqd · 55 000 so'm»: the way of paying on the button when there is a choice. */
function buttonText(
    t: Dictionary,
    input: { placing: boolean; total: string; method?: PaymentMethod; choice: boolean },
): string {
    if (input.placing) {
        return t.checkout.placing
    }
    const way =
        input.choice && input.method
            ? input.method === "cash"
                ? t.pay.cash
                : t.pay.cardShort
            : null
    return [t.checkout.place, way, input.total].filter(Boolean).join(" · ")
}

function EmptyCart(): React.JSX.Element {
    const t = useT()
    const back = useRouter((state) => state.back)
    return (
        <EmptyState
            art={<BagIcon size={44} />}
            title={t.cart.empty}
            text={t.cart.emptyText}
            action={
                <Button variant="secondary" onClick={back}>
                    {t.cart.toMenu}
                </Button>
            }
        />
    )
}

/** The order's details under the cart: phone, the way of paying, the place, bottles, comment. */
function OrderDetails({
    delivery,
    patch,
    glow,
    total,
    payment,
    editing,
    onEdit,
    bottles,
}: {
    delivery: Delivery
    patch(change: Partial<Delivery>): void
    glow(id: string): string
    total: number
    payment: ReturnType<typeof usePaymentMethod>
    editing: boolean
    onEdit(): void
    bottles: { usesBottles: boolean; returnable: number; value: number }
}): React.JSX.Element {
    const t = useT()
    return (
        <>
            <Section title={t.checkout.phone} id={CHECKOUT_PHONE} className={glow(CHECKOUT_PHONE)}>
                <PhoneRow />
                <p className="px-1 text-sm text-tg-hint">{t.checkout.phoneHint}</p>
            </Section>
            <PaymentSection
                total={total}
                methods={payment.methods}
                method={payment.method}
                onChoose={payment.setChosen}
            />
            <div className={glow(CHECKOUT_ADDRESS)}>
                {editing ? (
                    <AddressSection value={delivery} onChange={patch} />
                ) : (
                    <AddressSummary value={delivery} onEdit={onEdit} />
                )}
            </div>
            {bottles.usesBottles ? (
                <BottlesField
                    returnable={bottles.returnable}
                    value={bottles.value}
                    onChange={(bottlesReturned): void => patch({ bottlesReturned })}
                />
            ) : null}
            <Field label={`${t.checkout.comment} (${t.checkout.optional})`} htmlFor="comment">
                <TextArea
                    id="comment"
                    value={delivery.comment}
                    onChange={(e): void => patch({ comment: e.target.value })}
                    placeholder={t.checkout.commentPlaceholder}
                    maxLength={300}
                />
            </Field>
        </>
    )
}

/**
 * The cart and the order in one screen (owner's decision, October 2026: an order in 3 taps):
 * «+» on the menu, «Savat», «Buyurtma berish». A returning customer's phone and place are one
 * line each, so the button is all that is left.
 */
export function CheckoutScreen(): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const shop = useSession((state) => state.shop)
    const catalog = useSession((state) => state.catalog)
    const me = useSession((state) => state.me)
    const lines = useCart((state) => state.lines)
    const [delivery, patch] = useDraft(shop)
    // A place already complete (the last delivery) folds into one line until «O'zgartirish».
    const [editing, setEditing] = useState(() => !addressComplete(delivery, shop))
    const cart = summarize(lines, catalog)
    const rules: DeliveryRules = shop?.delivery ?? { fee: 0 }
    const fee = deliveryFee(cart.subtotal, rules)
    const bottles = bottlesOf(shop, cart.returnable, delivery.bottlesReturned)
    const payment = usePaymentMethod(shop)
    const { placing, place } = usePlaceOrder(
        { ...delivery, bottlesReturned: bottles.bottlesReturned },
        payment.method,
    )
    const total = cart.subtotal + fee + bottles.deposit
    const missing =
        shopStep(t, { shop, subtotal: cart.subtotal, rules, language }) ??
        customerStep(t, { phone: me?.phone, delivery, shop })
    const glow = useOrderButton({
        missing,
        placing,
        place,
        text:
            cart.count === 0
                ? null
                : buttonText(t, {
                      placing,
                      total: formatMoney(total, language),
                      method: payment.method,
                      choice: payment.methods.length > 1,
                  }),
        onReveal: (id): void => {
            if (id === CHECKOUT_ADDRESS) {
                setEditing(true)
            }
        },
    })

    if (cart.count === 0 && cart.unavailable.length === 0) {
        return <EmptyCart />
    }
    return (
        <main className="flex flex-col gap-6 px-4 pt-4">
            <CartLines cart={cart} rules={rules} shop={shop} />
            {cart.count > 0 && (!shop || takesOrdersNow(shop)) ? (
                <OrderDetails
                    delivery={delivery}
                    patch={patch}
                    glow={glow}
                    total={total}
                    payment={payment}
                    editing={editing}
                    onEdit={(): void => setEditing(true)}
                    bottles={{
                        usesBottles: bottles.usesBottles,
                        returnable: cart.returnable,
                        value: bottles.bottlesReturned,
                    }}
                />
            ) : null}
            <Totals
                rows={[
                    [t.cart.subtotal, cart.subtotal],
                    [t.cart.delivery, fee === 0 ? t.common.free : fee],
                    ...(bottles.deposit > 0
                        ? [[t.cart.deposit, bottles.deposit] as [string, number]]
                        : []),
                    [t.cart.total, total, true],
                ]}
            />
            <BottomSpacer />
        </main>
    )
}

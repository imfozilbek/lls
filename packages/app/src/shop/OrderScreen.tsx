import { OrderStatus, PaymentStatus, formatPhone, isFinalStatus } from "@zumda/core"
import { Suspense, lazy, useCallback, useEffect, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { formatMoney, formatTime } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { usePolling } from "../lib/polling.js"
import { useRefresh } from "../lib/refresh.js"
import { addToHomeScreen, canAddToHomeScreen, confirm, haptic } from "../lib/telegram.js"
import { useCachedState } from "../lib/use-cached.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import {
    CashIcon,
    CloseIcon,
    HeartHomeIcon,
    PhoneIcon,
    PinIcon,
    ScooterIcon,
    WifiOffIcon,
} from "../ui/icons.js"
import { OrderItems } from "../ui/order-items.js"
import { StatusHero, StatusTimeline } from "../ui/order-status.js"
import { CardBlock, PaymentLine } from "../ui/payment.js"
import { Button, EmptyState, Section, Skeleton } from "../ui/primitives.js"
import { ReceiptThumb } from "../ui/receipt.js"
import { BottomSpacer } from "../ui/shell.js"

import { useReorder } from "./reorder.js"

import type { Dictionary } from "../i18n/index.js"
import type { OrderDTO } from "@zumda/core"

/** Opened only by «O'tkazdim»: a cash order and a paid one never download it. */
const ReceiptSheet = lazy(() =>
    import("./ReceiptSheet.js").then((m) => ({ default: m.ReceiptSheet })),
)

/** Status changes arrive by bot message too, so a calm 20 s refresh is enough (free-tier friendly). */
const POLL_MS = 20_000

/** The screenshot already sent, when, and a way to send another while the shop checks. */
function SentReceipt({
    order,
    onReplace,
    onChange,
}: {
    order: OrderDTO
    onReplace(): void
    onChange(order: OrderDTO): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const sentAt = order.payment.receipt?.at
    return (
        <div className="flex flex-col gap-2">
            <div className="flex animate-fade-in gap-3 rounded-control bg-tg-secondary p-3">
                <ReceiptThumb orderId={order.id} sentAt={sentAt} />
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                    {sentAt ? (
                        <p className="font-medium">
                            {fill(t.pay.sentAt, { time: formatTime(sentAt, language) })}
                        </p>
                    ) : null}
                    <button
                        type="button"
                        onClick={onReplace}
                        className="tap -ml-1 mt-1 min-h-11 rounded-control px-1 text-sm font-semibold text-brand"
                    >
                        {t.pay.replace}
                    </button>
                </div>
            </div>
            <RemindShop order={order} onChange={onChange} />
        </div>
    )
}

/**
 * The shop is quiet longer than it usually is: one tap asks the owner again. Shown only once the
 * pause has passed (`payment.remindableAt`); the list refresh brings it back after the next one.
 */
function RemindShop({
    order,
    onChange,
}: {
    order: OrderDTO
    onChange(order: OrderDTO): void
}): React.JSX.Element | null {
    const t = useT()
    const [busy, setBusy] = useState(false)
    const at = order.payment.remindableAt
    if (!at || Date.parse(at) > Date.now()) {
        return null
    }
    const remind = async (): Promise<void> => {
        setBusy(true)
        try {
            onChange(await api.remindTransfer(order.id))
            haptic.success()
            toast(t.pay.reminded, "success")
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setBusy(false)
        }
    }
    return (
        <div className="flex animate-rise flex-col gap-2 rounded-control bg-warning/15 p-3">
            <p className="text-sm font-medium">{t.pay.remindAsk}</p>
            <Button variant="surface" loading={busy} onClick={(): void => void remind()}>
                {t.pay.remind}
            </Button>
        </div>
    )
}

/**
 * The shop's own number, when the owner gave one: a transfer the shop did not see is settled
 * fastest by a call. A quiet second way under the card; after «Pul kelmadi» it says why to call.
 */
function CallShop({ problem }: { problem: boolean }): React.JSX.Element | null {
    const t = useT()
    const phone = useSession((state) => state.shop?.contactPhone)
    if (!phone) {
        return null
    }
    return (
        <div className="flex flex-col gap-1.5">
            <a
                href={`tel:${phone}`}
                onClick={(): void => haptic.tap()}
                className="tap flex min-h-12 flex-wrap items-center justify-center gap-x-2 rounded-control bg-tg-secondary px-4 py-2 font-semibold"
            >
                <PhoneIcon size={18} className="text-brand" />
                {t.pay.callShop}
                <span className="font-normal tabular-nums text-tg-hint">{formatPhone(phone)}</span>
            </a>
            {problem ? <p className="px-1 text-sm text-tg-hint">{t.pay.callShopHint}</p> : null}
        </div>
    )
}

/**
 * Paid before the shop starts: until then the shop's card stays at hand with «O'tkazdim», which
 * asks for the screenshot of the transfer. After it the customer sees that the shop is checking,
 * and the screenshot they sent; «Pul kelmadi» from the shop brings the card back with a clear why.
 */
function Payment({
    order,
    onChange,
    onOpenSheet,
}: {
    order: OrderDTO
    onChange(order: OrderDTO): void
    /** «O'tkazdim» itself is the big bottom button; here only «Boshqa chek yuborish». */
    onOpenSheet(): void
}): React.JSX.Element {
    const t = useT()
    // The card this order was shown: the owner may have switched the payment card since.
    const shopCard = useSession((state) => state.shop?.payoutCard)
    const shopName = useSession((state) => state.shop?.name)
    const card = order.payment.card ?? shopCard
    const open = order.status !== OrderStatus.CANCELLED
    if (order.payment.method === "cash") {
        return <CashPayment order={order} />
    }
    const unpaid = open && order.payment.status === PaymentStatus.UNPAID
    const checking = open && order.payment.status === PaymentStatus.AWAITING

    return (
        <Section title={t.pay.title}>
            {/* While the money is open, the hero above already says where it stands. */}
            {unpaid || checking ? null : (
                <PaymentLine
                    order={order}
                    className="rounded-control bg-tg-secondary px-4 py-3 text-base"
                />
            )}
            {unpaid && card ? (
                <CardBlock
                    card={card}
                    total={order.total}
                    shopName={shopName}
                    again={order.payment.rejections > 0}
                />
            ) : null}
            {checking ? (
                <SentReceipt
                    order={order}
                    onChange={onChange}
                    onReplace={(): void => {
                        haptic.tap()
                        onOpenSheet()
                    }}
                />
            ) : null}
            {unpaid || checking ? (
                <CallShop problem={unpaid && order.payment.rejections > 0} />
            ) : null}
        </Section>
    )
}

/** Cash at the door: the sum to have ready until the courier takes it, then paid. */
function CashPayment({ order }: { order: OrderDTO }): React.JSX.Element | null {
    const t = useT()
    const language = useLanguage()
    const due = order.payment.status !== PaymentStatus.PAID
    if (order.status === OrderStatus.CANCELLED && due) {
        return null
    }
    return (
        <Section title={t.pay.cashTitle}>
            {due ? (
                <div className="flex gap-3 rounded-tile bg-tg-secondary p-4">
                    <CashIcon size={22} className="mt-0.5 shrink-0 text-brand" />
                    <div>
                        <p className="font-semibold">
                            {fill(t.pay.cashOrder, { sum: formatMoney(order.total, language) })}
                        </p>
                        <p className="mt-1 text-sm text-tg-subtitle">{t.pay.cashHint}</p>
                    </div>
                </div>
            ) : (
                <PaymentLine
                    order={order}
                    className="rounded-control bg-tg-secondary px-4 py-3 text-base"
                />
            )}
        </Section>
    )
}

/** Offered once per shop, after a delivered order. */
const HOME_OFFER_KEY = "zumda:home-offered:"

/**
 * After a delivered order, once per shop: the shop's icon on the phone's home screen, so the next
 * order is one tap away. Only where Telegram can do it (8.0) and the icon is not there yet.
 */
function HomeScreenOffer(): React.JSX.Element | null {
    const t = useT()
    const slug = useSession((state) => state.shop?.slug)
    const [offer, setOffer] = useState(false)
    useEffect(() => {
        if (!slug) {
            return
        }
        let seen = true
        try {
            seen = window.localStorage.getItem(HOME_OFFER_KEY + slug) !== null
        } catch {
            return
        }
        if (!seen) {
            void canAddToHomeScreen().then(setOffer)
        }
    }, [slug])
    if (!offer || !slug) {
        return null
    }
    const answer = (add: boolean): void => {
        try {
            window.localStorage.setItem(HOME_OFFER_KEY + slug, "1")
        } catch {
            // Private mode: the offer may come back once more, nothing breaks.
        }
        if (add) {
            haptic.tap()
            addToHomeScreen()
        }
        setOffer(false)
    }
    return (
        <div className="flex animate-rise items-center gap-3 rounded-tile bg-brand/10 p-4">
            <HeartHomeIcon size={24} className="shrink-0 text-brand" />
            <button
                type="button"
                onClick={(): void => answer(true)}
                className="tap min-w-0 flex-1 text-left"
            >
                <span className="block font-semibold">{t.order.homeScreen}</span>
                <span className="block text-sm text-tg-subtitle">{t.order.homeScreenHint}</span>
            </button>
            <button
                type="button"
                aria-label={t.common.no}
                onClick={(): void => answer(false)}
                className="tap -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-tg-hint"
            >
                <CloseIcon size={18} />
            </button>
        </div>
    )
}

function useOrder(id: string): {
    order: OrderDTO | null
    error: string | null
    reload(): Promise<void>
    setOrder(order: OrderDTO): void
} {
    const [order, setOrder] = useCachedState<OrderDTO>(`order:${id}`)
    const [error, setError] = useState<string | null>(null)

    const reload = useCallback(async (): Promise<void> => {
        try {
            setOrder(await api.order(id))
            setError(null)
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "generic")
        }
    }, [id, setOrder])

    const active = order !== null && !isFinalStatus(order.status)
    useEffect(() => {
        void reload()
    }, [reload])
    // Back from the bank app: the news at once, not after the next 20 s tick.
    usePolling(reload, POLL_MS, active)
    useRefresh(reload)

    return { order, error, reload, setOrder }
}

function OrderSkeleton(): React.JSX.Element {
    return (
        <main className="flex flex-col items-center gap-4 px-4 pt-10">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="mt-6 h-40 w-full rounded-tile" />
        </main>
    )
}

function Address({ order }: { order: OrderDTO }): React.JSX.Element {
    return (
        <div className="flex gap-3 rounded-tile bg-tg-secondary p-4">
            <PinIcon size={20} className="mt-0.5 shrink-0 text-brand" />
            <div className="min-w-0">
                <p className="font-medium">{order.address}</p>
                {order.landmark ? <p className="text-sm text-tg-hint">{order.landmark}</p> : null}
                {order.comment ? (
                    <p className="mt-1 text-sm italic text-tg-subtitle">«{order.comment}»</p>
                ) : null}
            </div>
        </div>
    )
}

/** Under the order: repeat a finished one, or cancel while the shop has not accepted it yet. */
function OrderActions({
    order,
    onChange,
    onStale,
}: {
    order: OrderDTO
    onChange(order: OrderDTO): void
    onStale(): Promise<void>
}): React.JSX.Element | null {
    const t = useT()
    const reorder = useReorder(order)
    const [cancelling, setCancelling] = useState(false)
    const [revealed, setRevealed] = useState(false)
    const cancelHidden = order.payment.status === PaymentStatus.AWAITING && !revealed

    const cancel = async (): Promise<void> => {
        const sent = order.payment.status === PaymentStatus.AWAITING
        const question = sent ? t.order.cancelAfterTransfer : t.order.cancelConfirm
        const options = { yes: t.order.cancel, no: t.common.no, destructive: true }
        if (!(await confirm(question, options))) {
            return
        }
        setCancelling(true)
        try {
            onChange(await api.cancelOrder(order.id))
            haptic.success()
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
            await onStale()
        } finally {
            setCancelling(false)
        }
    }

    if (reorder) {
        return (
            <Button variant="secondary" className="w-full" onClick={reorder}>
                {t.order.reorder}
            </Button>
        )
    }
    // Quiet and far from «O'tkazdim»: a mistaken tap here costs the order. While the shop checks
    // money already sent, it hides behind one more tap: panic is the wrong moment to cancel.
    if (order.status === OrderStatus.PENDING && cancelHidden) {
        return (
            <button
                type="button"
                onClick={(): void => setRevealed(true)}
                className="tap mx-auto min-h-11 rounded-control px-3 text-sm font-medium text-tg-subtitle"
            >
                {t.order.otherActions}
            </button>
        )
    }
    if (order.status === OrderStatus.PENDING) {
        return (
            <Button
                variant="quietDanger"
                className="mx-auto"
                loading={cancelling}
                onClick={(): void => void cancel()}
            >
                {t.order.cancel}
            </Button>
        )
    }
    return null
}

/** A new order is about the money: waiting for it, the shop checking it, or not found. */
function heroText(
    order: OrderDTO,
    t: Dictionary,
    justPlaced: boolean,
    sum: string,
): { title?: string; hint?: string; mood?: "pay" | "problem" } {
    if (order.status !== OrderStatus.PENDING) {
        return {}
    }
    if (order.payment.method === "cash") {
        return justPlaced ? { title: t.order.placedTitle } : {}
    }
    if (order.payment.status === PaymentStatus.AWAITING) {
        // Past the usual wait the promise turns into the truth, next to «Do'konga eslatish».
        const late =
            order.payment.remindableAt !== undefined &&
            Date.parse(order.payment.remindableAt) <= Date.now()
        return { title: t.pay.checkingTitle, hint: late ? t.pay.checkingLate : t.pay.checkingTime }
    }
    if (order.payment.rejections > 0) {
        return { title: t.pay.rejectedTitle, hint: t.pay.rejectedText, mood: "problem" }
    }
    return {
        title: justPlaced ? t.order.placedTitle : t.pay.waitingTitle,
        hint: fill(t.pay.waitingSum, { sum }),
        mood: "pay",
    }
}

/**
 * Unpaid: the big button is «O'tkazdim» (the one thing to do now). After that, right after
 * placing, it leads back to the menu; the order stays in "My orders".
 */
function useOrderMainAction(
    order: OrderDTO | null,
    justPlaced: boolean,
    openSheet: () => void,
): void {
    const t = useT()
    const reset = useRouter((state) => state.reset)
    const toPay =
        order !== null &&
        order.status !== OrderStatus.CANCELLED &&
        order.payment.method !== "cash" &&
        order.payment.status === PaymentStatus.UNPAID
    useMainAction(
        toPay
            ? {
                  text: order.payment.rejections > 0 ? t.pay.resend : t.pay.sent,
                  onClick: (): void => {
                      haptic.tap()
                      openSheet()
                  },
              }
            : justPlaced && order
              ? { text: t.cart.toMenu, onClick: (): void => reset() }
              : null,
    )
}

/** Number and time, the stages (or why it was cancelled), the courier, items and address. */
function OrderDetails({ order }: { order: OrderDTO }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    return (
        <>
            <div className="flex items-baseline justify-between px-1">
                <h2 className="text-lg font-bold">{fill(t.order.title, { n: order.number })}</h2>
                <span className="text-sm text-tg-hint">
                    {formatTime(order.createdAt, language)}
                </span>
            </div>

            {order.status !== "cancelled" ? (
                <div className="px-1">
                    <StatusTimeline
                        status={order.status}
                        payment={order.payment.status}
                        cash={order.payment.method === "cash"}
                    />
                </div>
            ) : order.cancelReason ? (
                <p className="rounded-control bg-danger/10 px-4 py-3 text-sm">
                    {order.cancelReason}
                </p>
            ) : null}

            {order.courierName && !isFinalStatus(order.status) ? (
                <p className="flex items-center gap-2 rounded-control bg-brand/10 px-4 py-3 font-medium">
                    <ScooterIcon size={20} className="text-brand" />
                    {fill(t.order.courier, { name: order.courierName })}
                </p>
            ) : null}

            <Section title={t.order.items}>
                <OrderItems order={order} />
            </Section>
            <Section title={t.order.address}>
                <Address order={order} />
            </Section>
        </>
    )
}

export function OrderScreen({
    id,
    justPlaced = false,
}: {
    id: string
    justPlaced?: boolean
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const { order, error, reload, setOrder } = useOrder(id)
    const [sheet, setSheet] = useState(false)
    useOrderMainAction(order, justPlaced, (): void => setSheet(true))

    if (!order) {
        if (!error) {
            return <OrderSkeleton />
        }
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

    const hero = heroText(order, t, justPlaced, formatMoney(order.total, language))
    // While the money is open, the card and the screenshot come right under the hero.
    const moneyFirst =
        order.status === OrderStatus.PENDING &&
        order.payment.method !== "cash" &&
        order.payment.status !== PaymentStatus.PAID
    const payment = (
        <Payment order={order} onChange={setOrder} onOpenSheet={(): void => setSheet(true)} />
    )
    return (
        <main className="flex flex-col gap-6 px-4">
            <StatusHero
                status={order.status}
                title={hero.title}
                hint={hero.hint}
                mood={hero.mood}
            />
            {moneyFirst ? payment : null}

            <OrderDetails order={order} />
            {moneyFirst ? null : payment}
            {sheet ? (
                <Suspense fallback={null}>
                    <ReceiptSheet
                        order={order}
                        onSent={setOrder}
                        onClose={(): void => setSheet(false)}
                    />
                </Suspense>
            ) : null}

            <OrderActions order={order} onChange={setOrder} onStale={reload} />
            {order.status === OrderStatus.DELIVERED ? <HomeScreenOffer /> : null}
            <BottomSpacer />
        </main>
    )
}

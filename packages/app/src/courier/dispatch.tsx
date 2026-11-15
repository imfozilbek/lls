import { DELIVERY_NOTE_MAX, OrderStatus, SendWay } from "@zumda/core"
import { createContext, useContext, useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { useClosingGuard } from "../lib/main-button.js"
import { haptic } from "../lib/telegram.js"
import { yandexRouteUrl } from "../lib/trips.js"
import { toast } from "../stores/toast.js"
import { PinIcon, StoreIcon } from "../ui/icons.js"
import { Button, Field, TextArea } from "../ui/primitives.js"
import { Sheet } from "../ui/sheet.js"

import type { CourierOrderDTO, OrderDTO } from "@zumda/core"

/**
 * A dispatcher (owner's decision, November 2026): the owner packs, the dispatcher sends the
 * parcel on by a taxi, the post or someone else, and writes the customer notes. The carrier is
 * never in Zumda: only the way and the notes are.
 */
interface Dispatch {
    /** «Jo'natdim»: asks the way and a note. */
    send(order: OrderDTO): void
    /** «Izoh qo'shish»: one more note for the customer. */
    note(order: OrderDTO): void
}

const DispatchContext = createContext<Dispatch | null>(null)

export function useDispatch(): Dispatch | null {
    return useContext(DispatchContext)
}

/** Holds the dispatcher's two sheets for every card of the screen. */
export function DispatchScope({
    onChange,
    onStale,
    children,
}: {
    onChange(order: OrderDTO): void
    onStale(): void
    children: React.ReactNode
}): React.JSX.Element {
    const [open, setOpen] = useState<{ kind: "send" | "note"; order: OrderDTO } | null>(null)
    const [scope] = useState<Dispatch>(() => ({
        send: (order): void => setOpen({ kind: "send", order }),
        note: (order): void => setOpen({ kind: "note", order }),
    }))
    const close = (): void => setOpen(null)
    const done = (order: OrderDTO): void => {
        onChange(order)
        close()
    }
    return (
        <DispatchContext.Provider value={scope}>
            {children}
            {open?.kind === "send" ? (
                <SendSheet order={open.order} onDone={done} onStale={onStale} onClose={close} />
            ) : null}
            {open?.kind === "note" ? (
                <NoteSheet order={open.order} onDone={done} onStale={onStale} onClose={close} />
            ) : null}
        </DispatchContext.Provider>
    )
}

const WAYS: readonly SendWay[] = [SendWay.TAXI, SendWay.POST, SendWay.SELF, SendWay.OTHER]

interface SheetProps {
    order: OrderDTO
    onDone(order: OrderDTO): void
    onStale(): void
    onClose(): void
}

/** One request at a time; a refusal says why and shows the order as it is now. */
function useSubmit(
    { onDone, onStale }: SheetProps,
    success: string,
): { busy: boolean; submit(request: () => Promise<OrderDTO>): Promise<void> } {
    const t = useT()
    const [busy, setBusy] = useState(false)
    const submit = async (request: () => Promise<OrderDTO>): Promise<void> => {
        if (busy) {
            return
        }
        setBusy(true)
        try {
            onDone(await request())
            haptic.success()
            toast(success, "success")
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
            onStale()
        } finally {
            setBusy(false)
        }
    }
    return { busy, submit }
}

/** «Jo'natdim»: how it went (a taxi, the post, the dispatcher themself, someone else) and a note. */
function SendSheet(props: SheetProps): React.JSX.Element {
    const { order, onClose } = props
    const t = useT()
    const c = t.courier
    const [way, setWay] = useState<SendWay | null>(null)
    const [note, setNote] = useState("")
    const { busy, submit } = useSubmit(props, fill(c.sentToast, { n: order.number }))
    // Something typed is never lost to a swipe.
    useClosingGuard(note.trim().length > 0)
    const needsNote = way === SendWay.OTHER && note.trim().length === 0
    const send = (): void => {
        if (way === null) {
            return
        }
        void submit(() => api.courier.send(order.id, way, note.trim() || undefined))
    }
    return (
        <Sheet
            title={fill(c.sendTitle, { n: order.number })}
            onClose={busy ? (): void => undefined : onClose}
            footer={
                <Button
                    size="lg"
                    loading={busy}
                    disabled={way === null || needsNote}
                    onClick={send}
                >
                    {c.send}
                </Button>
            }
        >
            <div role="radiogroup" aria-label={c.sendTitle} className="grid grid-cols-2 gap-2">
                {WAYS.map((option) => (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={way === option}
                        onClick={(): void => {
                            haptic.select()
                            setWay(option)
                        }}
                        className={cn(
                            "tap min-h-[52px] rounded-control px-3 font-semibold transition-colors duration-200",
                            way === option ? "bg-brand text-brand-ink" : "bg-tg-secondary",
                        )}
                    >
                        {c.ways[option]}
                    </button>
                ))}
            </div>
            <Field
                label={c.noteLabel}
                htmlFor="send-note"
                hint={needsNote ? c.noteNeeded : c.noteHint}
            >
                <TextArea
                    id="send-note"
                    value={note}
                    maxLength={DELIVERY_NOTE_MAX}
                    placeholder={c.notePlaceholder}
                    onChange={(e): void => setNote(e.target.value)}
                />
            </Field>
        </Sheet>
    )
}

/** «Izoh qo'shish»: the customer gets it from the shop's bot and sees it on the order. */
function NoteSheet(props: SheetProps): React.JSX.Element {
    const { order, onClose } = props
    const c = useT().courier
    const [text, setText] = useState("")
    const { busy, submit } = useSubmit(props, c.noteSent)
    useClosingGuard(text.trim().length > 0)
    return (
        <Sheet
            title={fill(c.noteTitle, { n: order.number })}
            onClose={busy ? (): void => undefined : onClose}
            footer={
                <Button
                    size="lg"
                    loading={busy}
                    disabled={text.trim().length === 0}
                    onClick={(): void => void submit(() => api.courier.addNote(order.id, text))}
                >
                    {c.noteSend}
                </Button>
            }
        >
            <Field label={c.noteLabel} htmlFor="delivery-note" hint={c.noteHint}>
                <TextArea
                    id="delivery-note"
                    value={text}
                    maxLength={DELIVERY_NOTE_MAX}
                    placeholder={c.notePlaceholder}
                    onChange={(e): void => setText(e.target.value)}
                    autoFocus
                />
            </Field>
        </Sheet>
    )
}

const BEFORE_SENT: readonly OrderStatus[] = [
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
]

function RouteLink({ href, label }: { href: string; label: string }): React.JSX.Element {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(): void => haptic.tap()}
            className="tap flex h-11 shrink-0 items-center gap-1.5 rounded-control bg-tg-secondary px-3 font-semibold text-brand"
        >
            <PinIcon size={18} />
            {label}
        </a>
    )
}

/**
 * Where from and where to, on every step: a dispatcher tells a taxi both, a rider sees where
 * the parcel goes once it is in the bag. The way to the shop only until it left.
 */
export function RouteBlock({ order }: { order: CourierOrderDTO }): React.JSX.Element {
    const c = useT().courier
    const atShop = BEFORE_SENT.includes(order.status)
    return (
        <div className="relative flex flex-col gap-3 rounded-control bg-tg-bg p-3">
            {/* The thread between the two ends: from the shop to the door. */}
            <span
                aria-hidden="true"
                className="absolute bottom-9 left-[1.3rem] top-9 w-px bg-tg-separator"
            />
            <div className="flex items-center gap-3">
                <StoreIcon size={18} className="relative shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm text-tg-hint">{c.from}</p>
                    <p className="font-medium">{order.shopAddress ?? order.shopName}</p>
                </div>
                {atShop && order.shopLocation ? (
                    <RouteLink href={yandexRouteUrl([order.shopLocation])} label={c.toShop} />
                ) : null}
            </div>
            <div className="flex items-center gap-3">
                <PinIcon size={18} className="relative shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm text-tg-hint">{c.to}</p>
                    <p className="font-medium">{order.address}</p>
                    {order.landmark ? <p className="text-tg-hint">{order.landmark}</p> : null}
                    {order.comment ? <p className="mt-1 italic">«{order.comment}»</p> : null}
                </div>
                {order.location ? (
                    <RouteLink href={yandexRouteUrl([order.location])} label={c.toCustomer} />
                ) : null}
            </div>
        </div>
    )
}

import { BusinessType, OrderStatus } from "@zumda/core"

import { fill, useT } from "../i18n/index.js"
import { api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { quantityMark } from "../lib/format.js"
import { confirm, haptic } from "../lib/telegram.js"
import { useSession } from "../stores/session.js"
import { CheckIcon } from "../ui/icons.js"
import { LinePhoto, useProductSheet, useProductsById } from "../ui/line-photo.js"

import { MissingButton, RemovedLines, canTakeOut } from "./missing-line.js"
import { togglePicked, usePicked } from "./picked.js"
import { useOwner } from "./store.js"

import type { OrderDTO, OrderItemDTO } from "@zumda/core"

/**
 * In «Yig'ish kerak» and while it is collected the card lists every line (owner's decision,
 * November 2026): the owner collects from the card, never from memory.
 */
export function isCollecting(order: OrderDTO): boolean {
    return order.status === OrderStatus.ACCEPTED || order.status === OrderStatus.PREPARING
}

/** Ticks once collecting started; a service has nothing to put in a bag. */
export function ticksOn(order: OrderDTO, type: BusinessType | undefined): boolean {
    return order.status === OrderStatus.PREPARING && type !== BusinessType.SERVICE
}

/**
 * Lines still unticked when the owner presses «Tayyor», or null when the ticks are not in use:
 * they are a help, so an owner who never ticks is never asked.
 */
export function unpickedBeforeReady(order: OrderDTO, picked: ReadonlySet<number>): number | null {
    const done = order.items.filter((item) => picked.has(item.line)).length
    const left = order.items.length - done
    return done > 0 && left > 0 ? left : null
}

/** The card's action: runs a request, shows the order it returns or why it failed. */
type Act = (request: () => Promise<OrderDTO>) => Promise<void>

/** The owner's next step; «Tayyor bo'ldi» with lines still unticked asks once first. */
export function useOwnerStep(order: OrderDTO, act: Act): (to: OrderStatus) => void {
    const t = useT()
    const picked = usePicked(order.id)
    return (to): void => {
        const left = to === OrderStatus.READY ? unpickedBeforeReady(order, picked) : null
        const go = async (): Promise<void> => {
            const sure =
                left === null ||
                (await confirm(fill(t.owner.picking.readyAsk, { n: left }), {
                    yes: t.owner.picking.readyYes,
                }))
            if (sure) {
                await act(() => api.owner.setStatus(order.id, to))
            }
        }
        void go()
    }
}

/** The quantity in its own column, the name, the variant and add-ons under it. */
function LineText({ item, done }: { item: OrderItemDTO; done: boolean }): React.JSX.Element {
    const t = useT()
    return (
        <>
            <span
                className={cn(
                    "min-w-[var(--qty)] shrink-0 text-lg font-bold leading-6 tabular-nums transition-colors duration-200",
                    done && "text-tg-hint",
                )}
            >
                {quantityMark(item.quantity, item.unit, t.units)}
            </span>
            <span
                className={cn(
                    "min-w-0 flex-1 leading-6 transition-colors duration-200",
                    done && "text-tg-hint",
                )}
            >
                <span className="font-medium">{item.name}</span>
                {item.options ? (
                    <span className="block text-sm leading-5 text-tg-subtitle">
                        {item.options.label}
                    </span>
                ) : null}
            </span>
        </>
    )
}

/** The square a tick draws itself into (the global reduced motion stops the stroke). */
function TickBox({ on }: { on: boolean }): React.JSX.Element {
    return (
        <span
            aria-hidden
            className={cn(
                "mt-px grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition-colors duration-150 ease-out-quart",
                on ? "border-brand bg-brand text-brand-ink" : "border-tg-hint bg-tg-bg",
            )}
        >
            {on ? <CheckIcon size={16} className="animate-tick [stroke-dasharray:20]" /> : null}
        </span>
    )
}

function CollectLine({
    order,
    item,
    ticks,
    picked,
    photo,
    onMissing,
}: {
    order: OrderDTO
    item: OrderItemDTO
    ticks: boolean
    picked: boolean
    /** The product's photo, its own button beside the tick (a button never holds a button). */
    photo: React.ReactNode
    onMissing?: () => void
}): React.JSX.Element {
    return (
        <li className="flex items-start gap-1">
            <span className="mt-0.5">{photo}</span>
            {ticks ? (
                <button
                    type="button"
                    role="checkbox"
                    aria-checked={picked}
                    onClick={(): void => {
                        haptic.tap()
                        togglePicked(order.id, item.line)
                    }}
                    className="tap -mr-2 flex min-h-11 flex-1 items-start gap-3 rounded-control px-2 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                    <TickBox on={picked} />
                    <LineText item={item} done={picked} />
                </button>
            ) : (
                <div className="flex min-h-11 flex-1 items-start gap-3 py-2.5 pl-2">
                    <LineText item={item} done={false} />
                </div>
            )}
            {onMissing ? (
                <span className="pt-2">
                    <MissingButton item={item} onPress={onMissing} />
                </span>
            ) : null}
        </li>
    )
}

/** «Yig'ildi: 2 / 5» over a thin bar; «Hammasi yig'ildi» once every line is ticked. */
function PickProgress({ done, all }: { done: number; all: number }): React.JSX.Element {
    const t = useT()
    const full = done === all
    return (
        <div className="mb-1" aria-live="polite">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
                {full ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-success/15 text-success">
                        <CheckIcon size={14} />
                    </span>
                ) : null}
                <span className="tabular-nums">
                    {full ? t.owner.picking.allDone : fill(t.owner.picking.counter, { done, all })}
                </span>
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-tg-separator">
                <div
                    className={cn(
                        "h-full rounded-full transition-[width,background-color] duration-300 ease-out-quart",
                        full ? "bg-success" : "bg-brand",
                    )}
                    style={{ width: `${Math.round((done / all) * 100)}%` }}
                />
            </div>
        </div>
    )
}

/** The customer's words, whole: «piyozsiz», «qaytim 100 000 dan». */
function CustomerAsk({ text }: { text: string }): React.JSX.Element {
    const t = useT()
    return (
        <div className="mt-2 rounded-control bg-tg-bg px-3 py-2.5">
            <p className="text-sm font-semibold text-tg-subtitle">{t.owner.picking.comment}</p>
            <p className="mt-0.5 whitespace-pre-line break-words">{text}</p>
        </div>
    )
}

/**
 * Every line of an order being collected, the missing ones struck through under them, and the
 * customer's words. Once collecting started each line is a tick (kept on this phone).
 */
export function CollectList({
    order,
    onMissing,
}: {
    order: OrderDTO
    /** «Yo'q» on a line, while it may still be taken out. */
    onMissing(item: OrderItemDTO): void
}): React.JSX.Element {
    const t = useT()
    const type = useSession((state) => state.shop?.type)
    const picked = usePicked(order.id)
    const ticks = ticksOn(order, type)
    const missing = canTakeOut(order)
    const products = useProductsById(useOwner((state) => state.products))
    const productSheet = useProductSheet()
    const done = ticks ? order.items.filter((item) => picked.has(item.line)).length : 0
    // The quantities as wide as the longest of this order («2 qadoq»): the names stand in a column.
    const widest = Math.max(
        ...order.items.map((item) => quantityMark(item.quantity, item.unit, t.units).length),
    )
    return (
        <div className="mt-3">
            {ticks ? <PickProgress done={done} all={order.items.length} /> : null}
            <ul className="flex flex-col" style={{ "--qty": `${widest}ch` } as React.CSSProperties}>
                {order.items.map((item) => (
                    <CollectLine
                        key={item.line}
                        order={order}
                        item={item}
                        ticks={ticks}
                        picked={ticks && picked.has(item.line)}
                        photo={
                            <LinePhoto
                                item={item}
                                product={products.get(item.productId)}
                                onOpen={productSheet.open}
                            />
                        }
                        onMissing={missing ? (): void => onMissing(item) : undefined}
                    />
                ))}
            </ul>
            <RemovedLines order={order} />
            {order.comment ? <CustomerAsk text={order.comment} /> : null}
            {productSheet.sheet}
        </div>
    )
}

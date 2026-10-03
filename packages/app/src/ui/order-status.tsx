import { BusinessType, OrderStatus, PaymentStatus } from "@zumda/core"

import { useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { useSession } from "../stores/session.js"

import {
    AlertIcon,
    CardIcon,
    ToolIcon,
    BoxIcon,
    ChefIcon,
    CheckIcon,
    ClockIcon,
    CloseIcon,
    HeartHomeIcon,
    ScooterIcon,
} from "./icons.js"

import type { Dictionary } from "../i18n/index.js"
import type { OrderDTO } from "@zumda/core"
import type { ReactNode } from "react"

const ICONS: Record<OrderStatus, (size: number) => ReactNode> = {
    pending: (s) => <ClockIcon size={s} />,
    accepted: (s) => <CheckIcon size={s} />,
    preparing: (s) => <ChefIcon size={s} />,
    ready: (s) => <BoxIcon size={s} />,
    picked_up: (s) => <ScooterIcon size={s} />,
    delivered: (s) => <HeartHomeIcon size={s} />,
    cancelled: (s) => <CloseIcon size={s} />,
}

/** «Preparing» by kind: a chef cooks, a toolbox serves, a box collects goods. */
const PREPARING_ICON: Record<BusinessType, (size: number) => ReactNode> = {
    [BusinessType.FOOD]: (s) => <ChefIcon size={s} />,
    [BusinessType.SERVICE]: (s) => <ToolIcon size={s} />,
    [BusinessType.GROCERY]: (s) => <BoxIcon size={s} />,
}

function useIcon(): (status: OrderStatus, size: number) => ReactNode {
    const type = useSession((state) => state.shop?.type) ?? BusinessType.GROCERY
    return (status, size) =>
        status === OrderStatus.PREPARING ? PREPARING_ICON[type](size) : ICONS[status](size)
}

/** Status tone: in progress = amber, done = green, cancelled = red, new = neutral.
 * Text stays in the theme color (AA in light and dark); only the tint and icon carry the hue. */
export function toneOf(status: OrderStatus): { tint: string; icon: string } {
    if (status === "delivered") {
        return { tint: "bg-success/15", icon: "text-success" }
    }
    if (status === "cancelled") {
        return { tint: "bg-danger/10", icon: "text-tg-destructive" }
    }
    if (status === "pending") {
        return { tint: "bg-tg-hint/15", icon: "text-tg-subtitle" }
    }
    return { tint: "bg-warning/15", icon: "text-warning" }
}

export function StatusBadge({ status }: { status: OrderStatus }): React.JSX.Element {
    const t = useT()
    const icon = useIcon()
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-tg-text",
                toneOf(status).tint,
            )}
        >
            <span className={toneOf(status).icon}>{icon(status, 14)}</span>
            {t.order.steps[status]}
        </span>
    )
}

/**
 * In a list, a new order is about its money: «O'tkazma kutilmoqda», then «Tekshirilmoqda» (the
 * owner reads «Tekshiring»). After that, the order's own step.
 */
export function OrderBadge({
    order,
    forOwner = false,
}: {
    order: OrderDTO
    forOwner?: boolean
}): React.JSX.Element {
    const t = useT()
    const payment = order.payment.status
    if (order.status !== OrderStatus.PENDING || payment === PaymentStatus.PAID) {
        return <StatusBadge status={order.status} />
    }
    const awaiting = payment === PaymentStatus.AWAITING
    const label = awaiting
        ? forOwner
            ? t.owner.checkBadge
            : t.pay.checkingShort
        : t.pay.status.unpaid
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-tg-text",
                awaiting && forOwner ? "bg-warning/20" : "bg-tg-hint/15",
            )}
        >
            <span className={awaiting && forOwner ? "text-warning" : "text-tg-subtitle"}>
                {awaiting && forOwner ? <AlertIcon size={14} /> : <CardIcon size={14} />}
            </span>
            {label}
        </span>
    )
}

/** The big status circle. Active orders breathe with a soft ring; finished ones sit still. */
export function StatusHero({
    status,
    title,
    hint,
    mood = "normal",
}: {
    status: OrderStatus
    title?: string
    hint?: string
    /**
     * `pay`: waiting for the transfer (a card, not a clock); `problem`: the shop did not find the
     * money, so it must not look like ordinary waiting.
     */
    mood?: "normal" | "pay" | "problem"
}): React.JSX.Element {
    const t = useT()
    const icon = useIcon()
    const active = status !== "delivered" && status !== "cancelled" && mood !== "problem"
    return (
        <div className="flex flex-col items-center py-6 text-center">
            <div className="relative mb-4 grid h-24 w-24 place-items-center">
                {active ? (
                    <span className="absolute inset-0 animate-ring rounded-full bg-brand/30" />
                ) : null}
                <span
                    key={status}
                    className={cn(
                        "relative grid h-24 w-24 animate-pop place-items-center rounded-full",
                        mood === "problem"
                            ? "bg-warning/20 text-warning"
                            : status === "cancelled"
                              ? "bg-danger/10 text-tg-destructive"
                              : status === "delivered"
                                ? "bg-success/15 text-success"
                                : "bg-brand text-brand-ink",
                    )}
                >
                    {mood === "problem" ? (
                        <AlertIcon size={40} />
                    ) : mood === "pay" ? (
                        <CardIcon size={40} />
                    ) : (
                        icon(status, 40)
                    )}
                </span>
            </div>
            <h1 className="text-2xl font-bold">{title ?? t.order.steps[status]}</h1>
            <p className="mt-1 max-w-[30ch] text-tg-hint">{hint ?? t.order.hints[status]}</p>
        </div>
    )
}

/**
 * The customer's four stages, not the shop's six steps: paid, being made (cooking and «ready»
 * are one wait for the customer), on the way, delivered.
 */
const STAGES: readonly { key: OrderStatus; covers: readonly OrderStatus[] }[] = [
    { key: OrderStatus.PENDING, covers: [OrderStatus.PENDING] },
    {
        key: OrderStatus.PREPARING,
        covers: [OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY],
    },
    { key: OrderStatus.PICKED_UP, covers: [OrderStatus.PICKED_UP] },
    { key: OrderStatus.DELIVERED, covers: [OrderStatus.DELIVERED] },
]

type StageState = "done" | "current" | "todo"

function stageState(index: number, current: number, status: OrderStatus): StageState {
    if (status === OrderStatus.CANCELLED) {
        return "todo"
    }
    // Delivered is the end: its own stage counts as done, not as waiting.
    if (index < current || (status === OrderStatus.DELIVERED && index === current)) {
        return "done"
    }
    return index === current ? "current" : "todo"
}

const DOT: Record<StageState, string> = {
    done: "bg-brand text-brand-ink",
    current: "bg-brand text-brand-ink ring-4 ring-brand/20",
    todo: "bg-tg-secondary text-tg-hint",
}
const LABEL: Record<StageState, string> = {
    done: "text-tg-text",
    current: "font-semibold text-tg-text",
    todo: "text-tg-hint",
}

/** The first stage is the money: waiting, being checked, then paid. */
function moneyStage(state: StageState, payment: PaymentStatus, t: Dictionary): string {
    if (state === "done") {
        return t.order.paidStage
    }
    return payment === PaymentStatus.AWAITING ? t.pay.checkingShort : t.pay.status.unpaid
}

/** Vertical progress: done stages filled, the current one highlighted, the rest quiet. */
export function StatusTimeline({
    status,
    payment,
}: {
    status: OrderStatus
    payment: PaymentStatus
}): React.JSX.Element {
    const t = useT()
    const icon = useIcon()
    const current = STAGES.findIndex((stage) => stage.covers.includes(status))
    return (
        <ol className="flex flex-col">
            {STAGES.map(({ key }, index) => {
                const state = stageState(index, current, status)
                const done = state === "done"
                const label =
                    key === OrderStatus.PENDING ? moneyStage(state, payment, t) : t.order.steps[key]
                return (
                    <li key={key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            <span
                                className={cn(
                                    "grid h-7 w-7 place-items-center rounded-full transition-colors duration-300",
                                    DOT[state],
                                )}
                            >
                                {done ? (
                                    <CheckIcon size={15} strokeWidth={2.5} />
                                ) : key === OrderStatus.PENDING ? (
                                    <CardIcon size={15} />
                                ) : (
                                    icon(key, 15)
                                )}
                            </span>
                            {index < STAGES.length - 1 ? (
                                <span
                                    className={cn(
                                        "my-1 w-0.5 flex-1 rounded-full",
                                        done ? "bg-brand" : "bg-tg-separator",
                                    )}
                                />
                            ) : null}
                        </div>
                        <p className={cn("pb-5 pt-0.5", LABEL[state])}>{label}</p>
                    </li>
                )
            })}
        </ol>
    )
}

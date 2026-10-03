import { BusinessType, OrderStatus } from "@zumda/core"

import { useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { useSession } from "../stores/session.js"

import {
    ToolIcon,
    BoxIcon,
    ChefIcon,
    CheckIcon,
    ClockIcon,
    CloseIcon,
    HeartHomeIcon,
    ScooterIcon,
} from "./icons.js"

import type { ReactNode } from "react"

const FLOW: readonly OrderStatus[] = [
    "pending",
    "accepted",
    "preparing",
    "ready",
    "picked_up",
    "delivered",
] as OrderStatus[]

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

/** The big status circle. Active orders breathe with a soft ring; finished ones sit still. */
export function StatusHero({
    status,
    title,
    hint,
}: {
    status: OrderStatus
    title?: string
    hint?: string
}): React.JSX.Element {
    const t = useT()
    const icon = useIcon()
    const active = status !== "delivered" && status !== "cancelled"
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
                        status === "cancelled"
                            ? "bg-danger/10 text-tg-destructive"
                            : status === "delivered"
                              ? "bg-success/15 text-success"
                              : "bg-brand text-brand-ink",
                    )}
                >
                    {icon(status, 40)}
                </span>
            </div>
            <h1 className="text-2xl font-bold">{title ?? t.order.steps[status]}</h1>
            <p className="mt-1 max-w-[30ch] text-tg-hint">{hint ?? t.order.hints[status]}</p>
        </div>
    )
}

/** Vertical progress: done steps filled, the current one highlighted, the rest quiet. */
export function StatusTimeline({ status }: { status: OrderStatus }): React.JSX.Element {
    const t = useT()
    const icon = useIcon()
    const current = FLOW.indexOf(status)
    const cancelled = status === "cancelled"
    return (
        <ol className="flex flex-col">
            {FLOW.map((step, index) => {
                const done = !cancelled && index < current
                const isCurrent = !cancelled && index === current
                return (
                    <li key={step} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            <span
                                className={cn(
                                    "grid h-7 w-7 place-items-center rounded-full transition-colors duration-300",
                                    done && "bg-brand text-brand-ink",
                                    isCurrent && "bg-brand text-brand-ink ring-4 ring-brand/20",
                                    !done && !isCurrent && "bg-tg-secondary text-tg-hint",
                                )}
                            >
                                {done ? <CheckIcon size={15} strokeWidth={2.5} /> : icon(step, 15)}
                            </span>
                            {index < FLOW.length - 1 ? (
                                <span
                                    className={cn(
                                        "my-1 w-0.5 flex-1 rounded-full",
                                        done ? "bg-brand" : "bg-tg-separator",
                                    )}
                                />
                            ) : null}
                        </div>
                        <p
                            className={cn(
                                "pb-5 pt-0.5",
                                isCurrent ? "font-semibold text-tg-text" : "text-tg-hint",
                                done && "text-tg-text",
                            )}
                        >
                            {t.order.steps[step]}
                        </p>
                    </li>
                )
            })}
        </ol>
    )
}

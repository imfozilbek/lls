import { MONEY_PERIODS, OrderStatus } from "@zumda/core"
import { useCallback, useEffect, useRef, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api, scopedKey } from "../lib/api.js"
import { cached, remember } from "../lib/cache.js"
import { cn } from "../lib/cn.js"
import { formatMoney } from "../lib/format.js"
import { useRefresh } from "../lib/refresh.js"
import { confirm, haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import {
    CardIcon,
    CashIcon,
    ChartIcon,
    CheckIcon,
    ReceiptIcon,
    ScooterIcon,
    WifiOffIcon,
} from "../ui/icons.js"
import { Button, EmptyState, Segmented, Skeleton } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import { PaymentCheckSheet } from "./PaymentCheck.js"

import type { Dictionary } from "../i18n/index.js"
import type { CourierCashDTO, MoneyPeriod, MoneyReportDTO, OrderDTO } from "@zumda/core"
import type { ReactNode } from "react"

function failToast(t: Dictionary, caught: unknown): void {
    haptic.error()
    toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
}

/** Runs one money action, then shows the fresh report: sums and lists move together. */
function useAction(reload: () => Promise<void>): {
    busy: string | null
    run(key: string, action: () => Promise<unknown>): Promise<void>
} {
    const t = useT()
    const [busy, setBusy] = useState<string | null>(null)
    const run = async (key: string, action: () => Promise<unknown>): Promise<void> => {
        setBusy(key)
        try {
            await action()
            haptic.success()
        } catch (caught) {
            failToast(t, caught)
        } finally {
            await reload()
            setBusy(null)
        }
    }
    return { busy, run }
}

function Row({
    label,
    value,
    icon,
    strong = false,
}: {
    label: string
    value: string
    icon?: ReactNode
    strong?: boolean
}): React.JSX.Element {
    return (
        <p className="flex items-center gap-2 py-1">
            {icon ? <span className="shrink-0">{icon}</span> : null}
            <span className={strong ? "flex-1 font-semibold" : "flex-1 text-tg-subtitle"}>
                {label}
            </span>
            <span className="font-semibold tabular-nums">{value}</span>
        </p>
    )
}

/** What the period brought: revenue, the transfers that came in, and the order counts. */
function Totals({ report }: { report: MoneyReportDTO }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const m = t.owner.money
    const sum = (amount: number): string => formatMoney(amount, language)
    const { totals } = report
    const cells = [
        { label: m.orders, value: totals.placed },
        { label: m.delivered, value: totals.delivered },
        { label: m.cancelled, value: totals.cancelled },
    ]
    return (
        <section className="animate-rise rounded-tile bg-tg-secondary p-4">
            <p className="font-semibold">{m.received}</p>
            <p className="text-3xl font-bold tabular-nums">{sum(totals.goods + totals.delivery)}</p>
            <p className="text-sm text-tg-subtitle">{m.receivedHint}</p>
            {/* Orders still on their way: money that is coming, so «0 so'm» never looks wrong. */}
            {totals.placed - totals.delivered - totals.cancelled > 0 ? (
                <p className="mt-1 text-sm font-medium">
                    {fill(m.inProgress, {
                        n: totals.placed - totals.delivered - totals.cancelled,
                    })}
                </p>
            ) : null}
            <div className="mt-3 rounded-control bg-tg-bg px-3 py-2 text-sm">
                <Row label={m.goods} value={sum(totals.goods)} />
                <Row label={m.delivery} value={sum(totals.delivery)} />
                {totals.paidCash > 0 ? (
                    <>
                        {totals.paid > totals.paidCash ? (
                            <Row
                                label={m.byCard}
                                value={sum(totals.paid - totals.paidCash)}
                                icon={<CardIcon size={16} className="text-tg-hint" />}
                            />
                        ) : null}
                        <Row
                            label={m.byCash}
                            value={sum(totals.paidCash)}
                            icon={<CashIcon size={16} className="text-tg-hint" />}
                        />
                    </>
                ) : null}
                {totals.deposits > 0 ? (
                    <Row label={m.deposits} value={sum(totals.deposits)} />
                ) : null}
                {totals.commission > 0 ? (
                    <Row label={m.commission} value={`−${sum(totals.commission)}`} />
                ) : null}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
                {cells.map((cell) => (
                    <div key={cell.label} className="rounded-control bg-tg-bg px-3 py-2.5">
                        <p className="text-xl font-bold tabular-nums">{cell.value}</p>
                        <p className="text-xs text-tg-hint">{cell.label}</p>
                    </div>
                ))}
            </div>
        </section>
    )
}

/** One order that needs the owner: number, customer, sum, and the buttons that settle it. */
function OpenOrder({
    order,
    children,
}: {
    order: OrderDTO
    children: ReactNode
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    return (
        <li className="animate-rise rounded-control bg-tg-bg p-3">
            <p className="flex items-baseline gap-2">
                <span className="font-bold">{fill(t.order.title, { n: order.number })}</span>
                {order.status === OrderStatus.CANCELLED ? (
                    <span className="rounded-full bg-danger/10 px-2 text-xs">
                        {t.order.steps.cancelled}
                    </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-sm text-tg-hint">
                    {order.customerName}
                </span>
                <span className="font-semibold tabular-nums">
                    {formatMoney(order.total, language)}
                </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">{children}</div>
        </li>
    )
}

function ListBlock({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
    return (
        <section className="rounded-tile bg-tg-secondary p-4">
            <h2 className="mb-3 text-sm font-semibold text-tg-subtitle">{title}</h2>
            <ul className="flex flex-col gap-2">{children}</ul>
        </section>
    )
}

/**
 * Cash the shop's couriers took at the door and still hold: per courier, per order. «Pulni oldim»
 * on each order, asked once more, as the courier hands it over.
 */
function CourierCash({
    groups,
    reload,
}: {
    groups: CourierCashDTO[]
    reload(): Promise<void>
}): React.JSX.Element | null {
    const t = useT()
    const language = useLanguage()
    const m = t.owner.money
    const { busy, run } = useAction(reload)
    if (groups.length === 0) {
        return null
    }
    const take = async (group: CourierCashDTO, order: OrderDTO): Promise<void> => {
        const question = fill(m.cashConfirm, {
            name: group.courierName,
            n: order.number,
            sum: formatMoney(order.total, language),
        })
        if (!(await confirm(question))) {
            return
        }
        await run(order.id, async () => {
            await api.owner.receiveCash(order.id)
            toast(m.cashTaken, "success")
        })
    }
    return (
        <section
            aria-label={m.courierCashTitle}
            className="animate-rise rounded-tile bg-tg-secondary p-4"
        >
            <h2 className="text-sm font-semibold text-tg-subtitle">{m.courierCashTitle}</h2>
            <p className="mb-3 text-sm text-tg-hint">{m.courierCashHint}</p>
            <div className="flex flex-col gap-4">
                {groups.map((group) => (
                    <div key={group.courierId} className="flex flex-col gap-2">
                        <p className="flex items-center gap-2 px-1">
                            <ScooterIcon size={18} className="shrink-0 text-brand" />
                            <span className="min-w-0 flex-1 truncate font-semibold">
                                {group.courierName}
                            </span>
                            <span className="font-bold tabular-nums">
                                {formatMoney(group.total, language)}
                            </span>
                        </p>
                        <ul className="flex flex-col gap-2">
                            {group.orders.map((order) => (
                                <OpenOrder key={order.id} order={order}>
                                    <Button
                                        className="grow"
                                        variant="surface"
                                        icon={<CashIcon size={18} />}
                                        loading={busy === order.id}
                                        onClick={(): void => void take(group, order)}
                                    >
                                        {m.cashReceived}
                                    </Button>
                                </OpenOrder>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    )
}

/** Transfers to check and money owed back: what needs the owner now. */
function OpenPayments({
    report,
    reload,
}: {
    report: MoneyReportDTO
    reload(): Promise<void>
}): React.JSX.Element {
    const t = useT()
    const m = t.owner.money
    const { busy, run } = useAction(reload)
    const [checking, setChecking] = useState<OrderDTO | null>(null)
    const refresh = (): void => void reload()
    if (report.awaiting.length + report.refunds.length + report.courierCash.length === 0) {
        return (
            <p className="flex items-center gap-2 px-1 text-sm text-tg-hint">
                <CheckIcon size={18} className="shrink-0 text-success" />
                {m.allClear}
            </p>
        )
    }
    return (
        <>
            {report.awaiting.length > 0 ? (
                <ListBlock title={m.awaitingTitle}>
                    {report.awaiting.map((order) => (
                        <OpenOrder key={order.id} order={order}>
                            <Button
                                className="grow"
                                icon={<CardIcon size={18} />}
                                onClick={(): void => {
                                    haptic.tap()
                                    setChecking(order)
                                }}
                            >
                                {order.status === OrderStatus.CANCELLED
                                    ? m.confirmCancelled
                                    : m.confirm}
                            </Button>
                        </OpenOrder>
                    ))}
                </ListBlock>
            ) : null}
            {report.refunds.length > 0 ? (
                <ListBlock title={m.refundsTitle}>
                    {report.refunds.map((order) => (
                        <OpenOrder key={order.id} order={order}>
                            <Button
                                variant="danger"
                                className="grow"
                                loading={busy === order.id}
                                onClick={(): void =>
                                    void run(order.id, () => api.owner.markRefunded(order.id))
                                }
                            >
                                {m.refunded}
                            </Button>
                        </OpenOrder>
                    ))}
                </ListBlock>
            ) : null}
            {checking ? (
                <PaymentCheckSheet
                    order={checking}
                    onChange={refresh}
                    onStale={refresh}
                    onClose={(): void => setChecking(null)}
                />
            ) : null}
        </>
    )
}

function isEmpty(report: MoneyReportDTO): boolean {
    const { totals } = report
    return (
        totals.placed + totals.delivered + totals.cancelled === 0 &&
        report.awaiting.length + report.refunds.length + report.courierCash.length === 0
    )
}

/** "Отчёт для Excel": the bot sends the period's orders to the owner's chat. */
function ExportButton({ period }: { period: MoneyPeriod }): React.JSX.Element {
    const t = useT()
    const [busy, setBusy] = useState(false)
    const send = async (): Promise<void> => {
        setBusy(true)
        try {
            const { delivered } = await api.owner.exportMoney(period)
            if (delivered === "shop") {
                haptic.success()
                toast(t.owner.money.exportSent, "success")
            } else {
                haptic.warning()
                if (delivered === "business") {
                    toast(t.owner.money.exportSentBusiness, "info")
                } else {
                    toast(t.owner.money.exportSentNone, "error")
                }
            }
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setBusy(false)
        }
    }
    return (
        <Button
            variant="secondary"
            loading={busy}
            icon={<ReceiptIcon size={18} />}
            onClick={(): void => void send()}
        >
            {t.owner.money.export}
        </Button>
    )
}

const reportKey = (period: MoneyPeriod): string => `money:${scopedKey(period)}`

function useReport(period: MoneyPeriod): {
    report: MoneyReportDTO | null
    /** The report on screen is another period's: the new one is on its way. */
    switching: boolean
    error: string | null
    load(): Promise<void>
} {
    // This session's copy shows at once; switching periods keeps the old one, dimmed, until
    // the new one arrives: no skeleton blinking over the same tab.
    const [report, setReport] = useState<MoneyReportDTO | null>(
        () => cached<MoneyReportDTO>(reportKey(period)) ?? null,
    )
    const [error, setError] = useState<string | null>(null)
    // A slow answer for the period left behind never shows under the new one.
    const latest = useRef(period)
    latest.current = period
    const load = useCallback(async (): Promise<void> => {
        setError(null)
        try {
            const next = await api.owner.money(period)
            if (latest.current === period) {
                setReport(remember(reportKey(period), next))
            }
        } catch (caught) {
            if (latest.current === period) {
                setError(caught instanceof ApiError ? caught.code : "generic")
            }
        }
    }, [period])
    useEffect(() => {
        const copy = cached<MoneyReportDTO>(reportKey(period))
        if (copy) {
            setReport(copy)
        }
        void load()
    }, [load, period])
    return { report, switching: report !== null && report.period !== period, error, load }
}

function Body({ report, switching, error, load }: ReturnType<typeof useReport>): React.JSX.Element {
    const t = useT()
    if (error && !report) {
        return (
            <EmptyState
                art={<WifiOffIcon size={44} />}
                title={errorText(t, error)}
                action={
                    <Button variant="secondary" onClick={(): void => void load()}>
                        {t.common.retry}
                    </Button>
                }
            />
        )
    }
    if (!report) {
        return (
            <>
                <Skeleton className="h-72 rounded-tile" />
                <Skeleton className="h-24 rounded-tile" />
            </>
        )
    }
    if (isEmpty(report)) {
        return (
            <EmptyState
                art={<ChartIcon size={44} />}
                title={t.owner.money.emptyTitle}
                text={t.owner.money.emptyText}
            />
        )
    }
    return (
        <div
            aria-busy={switching}
            className={cn(
                "flex flex-col gap-3 transition-opacity duration-200",
                switching && "opacity-60",
            )}
        >
            <Totals report={report} />
            <CourierCash groups={report.courierCash} reload={load} />
            <OpenPayments report={report} reload={load} />
            <ExportButton period={report.period} />
        </div>
    )
}

/** «Pul»: what came in by transfer and in cash, and what still needs the owner. */
export function MoneyTab(): React.JSX.Element {
    const t = useT()
    const [period, setPeriod] = useState<MoneyPeriod>("today")
    const state = useReport(period)
    useRefresh(state.load)
    return (
        <div className="flex flex-col gap-3 px-4 pt-2">
            <Segmented<MoneyPeriod>
                value={period}
                onChange={setPeriod}
                options={MONEY_PERIODS.map((value) => ({
                    value,
                    label: t.owner.money.periods[value],
                }))}
            />
            <Body {...state} />
            <BottomSpacer />
        </div>
    )
}

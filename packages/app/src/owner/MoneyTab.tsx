import { MONEY_PERIODS, PaymentMethod } from "@lls/core"
import { useCallback, useEffect, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { formatMoney } from "../lib/format.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { CardIcon, CashIcon, ChartIcon, CheckIcon, ReceiptIcon, WifiOffIcon } from "../ui/icons.js"
import { Button, EmptyState, MoneyInput, Segmented, Skeleton } from "../ui/primitives.js"
import { Sheet } from "../ui/sheet.js"
import { BottomSpacer } from "../ui/shell.js"

import type { Dictionary } from "../i18n/index.js"
import type { CourierCashDTO, MoneyPeriod, MoneyReportDTO, OrderDTO } from "@lls/core"
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

/** What the period brought: revenue, how it came in, and the order counts. */
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
            <p className="text-sm text-tg-hint">{m.received}</p>
            <p className="text-3xl font-bold tabular-nums">{sum(totals.goods + totals.delivery)}</p>
            <div className="mt-3 rounded-control bg-tg-bg px-3 py-2 text-sm">
                <Row label={m.goods} value={sum(totals.goods)} />
                <Row label={m.delivery} value={sum(totals.delivery)} />
                {totals.deposits > 0 ? (
                    <Row label={m.deposits} value={sum(totals.deposits)} />
                ) : null}
                {totals.commission > 0 ? (
                    <Row label={m.commission} value={`−${sum(totals.commission)}`} />
                ) : null}
            </div>
            <div className="mt-2 rounded-control bg-tg-bg px-3 py-2 text-sm">
                <Row
                    label={m.cash}
                    value={sum(totals.paidCash)}
                    icon={<CashIcon size={18} className="text-success" />}
                />
                <Row
                    label={m.card}
                    value={sum(totals.paidCard)}
                    icon={<CardIcon size={18} className="text-success" />}
                />
                {totals.awaiting > 0 ? (
                    <Row
                        label={t.pay.status.awaiting}
                        value={sum(totals.awaiting)}
                        icon={<CardIcon size={18} className="text-warning" />}
                    />
                ) : null}
                {totals.debt > 0 ? (
                    <Row
                        label={m.debtsTitle}
                        value={sum(totals.debt)}
                        icon={<ReceiptIcon size={18} className="text-tg-destructive" />}
                    />
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

/** "Принял деньги": the amount starts at everything the courier holds; less is fine. */
function HandoverSheet({
    courier,
    onDone,
    onClose,
}: {
    courier: CourierCashDTO
    onDone(amount: number): void
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    const [amount, setAmount] = useState<number | null>(courier.onHand)
    const valid = amount !== null && amount > 0 && amount <= courier.onHand
    return (
        <Sheet title={`${t.owner.money.handoverAmount} · ${courier.name}`} onClose={onClose}>
            <MoneyInput value={amount} onChange={setAmount} />
            <Button
                size="lg"
                disabled={!valid}
                onClick={(): void => {
                    if (valid) {
                        onClose()
                        onDone(amount)
                    }
                }}
            >
                {t.owner.money.handover}
            </Button>
        </Sheet>
    )
}

function Couriers({
    couriers,
    busy,
    onHandover,
}: {
    couriers: CourierCashDTO[]
    busy: string | null
    onHandover(courier: CourierCashDTO, amount: number): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const [open, setOpen] = useState<CourierCashDTO | null>(null)
    return (
        <ListBlock title={t.owner.money.couriersTitle}>
            {couriers.map((courier) => (
                <li
                    key={courier.courierId}
                    className="flex animate-rise items-center gap-3 rounded-control bg-tg-bg p-3"
                >
                    <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{courier.name}</span>
                        {courier.isActive ? null : (
                            <span className="text-xs text-tg-hint">{t.owner.money.inactive}</span>
                        )}
                    </span>
                    <span className="font-bold tabular-nums">
                        {formatMoney(courier.onHand, language)}
                    </span>
                    <Button
                        variant="secondary"
                        loading={busy === courier.courierId}
                        onClick={(): void => setOpen(courier)}
                    >
                        {t.owner.money.handover}
                    </Button>
                </li>
            ))}
            {open ? (
                <HandoverSheet
                    courier={open}
                    onClose={(): void => setOpen(null)}
                    onDone={(amount): void => onHandover(open, amount)}
                />
            ) : null}
        </ListBlock>
    )
}

/** Delivered, not paid: the owner marks how the debt was paid when it comes in. */
function Debts({
    orders,
    busy,
    confirm,
}: {
    orders: OrderDTO[]
    busy: string | null
    confirm(order: OrderDTO, method: PaymentMethod): Promise<void>
}): React.JSX.Element {
    const m = useT().owner.money
    return (
        <ListBlock title={m.debtsTitle}>
            {orders.map((order) => (
                <OpenOrder key={order.id} order={order}>
                    <Button
                        variant="secondary"
                        className="grow"
                        icon={<CashIcon size={18} />}
                        loading={busy === `${order.id}:${PaymentMethod.CASH}`}
                        onClick={(): void => void confirm(order, PaymentMethod.CASH)}
                    >
                        {m.paidCash}
                    </Button>
                    <Button
                        variant="secondary"
                        className="grow"
                        icon={<CardIcon size={18} />}
                        loading={busy === `${order.id}:${PaymentMethod.CARD_TRANSFER}`}
                        onClick={(): void => void confirm(order, PaymentMethod.CARD_TRANSFER)}
                    >
                        {m.paidCard}
                    </Button>
                </OpenOrder>
            ))}
        </ListBlock>
    )
}

/** Transfers to confirm, debts, money owed back and couriers' cash: what needs the owner now. */
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
    const confirm = (order: OrderDTO, method: PaymentMethod): Promise<void> =>
        run(`${order.id}:${method}`, () => api.owner.confirmPayment(order.id, method))
    const nothingOpen =
        report.awaiting.length + report.debts.length + report.refunds.length === 0 &&
        report.couriers.length === 0
    if (nothingOpen) {
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
                                loading={busy === `${order.id}:${PaymentMethod.CARD_TRANSFER}`}
                                onClick={(): void =>
                                    void confirm(order, PaymentMethod.CARD_TRANSFER)
                                }
                            >
                                {m.confirm}
                            </Button>
                        </OpenOrder>
                    ))}
                </ListBlock>
            ) : null}
            {report.debts.length > 0 ? (
                <Debts orders={report.debts} busy={busy} confirm={confirm} />
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
            {report.couriers.length > 0 ? (
                <Couriers
                    couriers={report.couriers}
                    busy={busy}
                    onHandover={(courier, amount): void =>
                        void run(courier.courierId, () =>
                            api.owner.handover(courier.courierId, amount),
                        )
                    }
                />
            ) : null}
        </>
    )
}

function isEmpty(report: MoneyReportDTO): boolean {
    const { totals } = report
    return (
        totals.placed + totals.delivered + totals.cancelled === 0 &&
        report.awaiting.length + report.debts.length + report.refunds.length === 0 &&
        report.couriers.length === 0
    )
}

/** "Отчёт для Excel": the bot sends the period's orders to the owner's chat. */
function ExportButton({ period }: { period: MoneyPeriod }): React.JSX.Element {
    const t = useT()
    const [busy, setBusy] = useState(false)
    const send = async (): Promise<void> => {
        setBusy(true)
        try {
            await api.owner.exportMoney(period)
            haptic.success()
            toast(t.owner.money.exportSent, "success")
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

function useReport(period: MoneyPeriod): {
    report: MoneyReportDTO | null
    error: string | null
    load(): Promise<void>
} {
    const [report, setReport] = useState<MoneyReportDTO | null>(null)
    const [error, setError] = useState<string | null>(null)
    const load = useCallback(async (): Promise<void> => {
        setError(null)
        try {
            setReport(await api.owner.money(period))
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "generic")
        }
    }, [period])
    useEffect(() => {
        setReport(null)
        void load()
    }, [load])
    return { report, error, load }
}

function Body({ report, error, load }: ReturnType<typeof useReport>): React.JSX.Element {
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
        <>
            <Totals report={report} />
            <OpenPayments report={report} reload={load} />
            <ExportButton period={report.period} />
        </>
    )
}

/** «Деньги»: what came in, how, and what still needs the owner. */
export function MoneyTab(): React.JSX.Element {
    const t = useT()
    const [period, setPeriod] = useState<MoneyPeriod>("today")
    const state = useReport(period)
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

import { useEffect, useState } from "react"

import { errorText, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { formatMoney } from "../lib/format.js"
import { ChartIcon, WifiOffIcon } from "../ui/icons.js"
import { Button, EmptyState, Skeleton } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import type { OrderStatsDTO, ShopStatsDTO } from "@lls/core"

function Period({ title, stats }: { title: string; stats: OrderStatsDTO }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const cells = [
        { label: t.owner.stats.orders, value: stats.orders },
        { label: t.owner.stats.delivered, value: stats.delivered },
        { label: t.owner.stats.cancelled, value: stats.cancelled },
    ]
    return (
        <section className="animate-rise rounded-tile bg-tg-secondary p-4">
            <h2 className="text-sm font-semibold text-tg-subtitle">{title}</h2>
            <p className="mt-2 text-sm text-tg-hint">{t.owner.stats.revenue}</p>
            <p className="text-3xl font-bold tabular-nums">
                {formatMoney(stats.revenue, language)}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
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

export function StatsTab(): React.JSX.Element {
    const t = useT()
    const [stats, setStats] = useState<ShopStatsDTO | null>(null)
    const [error, setError] = useState<string | null>(null)

    const load = async (): Promise<void> => {
        setError(null)
        try {
            setStats(await api.owner.stats())
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "generic")
        }
    }
    useEffect(() => {
        void load()
    }, [])

    if (error) {
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
    if (!stats) {
        return (
            <div className="flex flex-col gap-3 px-4 pt-2">
                <Skeleton className="h-44 rounded-tile" />
                <Skeleton className="h-44 rounded-tile" />
            </div>
        )
    }
    if (stats.week.orders === 0 && stats.week.cancelled === 0) {
        return (
            <EmptyState
                art={<ChartIcon size={44} />}
                title={t.owner.stats.emptyTitle}
                text={t.owner.stats.emptyText}
            />
        )
    }
    return (
        <div className="flex flex-col gap-3 px-4 pt-2">
            <Period title={t.owner.stats.today} stats={stats.today} />
            <Period title={t.owner.stats.week} stats={stats.week} />
            <BottomSpacer />
        </div>
    )
}

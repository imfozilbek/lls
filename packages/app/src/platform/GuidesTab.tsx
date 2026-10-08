import { useCallback, useEffect, useRef, useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, adminApi } from "../lib/api.js"
import { useRefresh } from "../lib/refresh.js"
import { confirm, haptic } from "../lib/telegram.js"
import { useCachedState } from "../lib/use-cached.js"
import { toast } from "../stores/toast.js"
import { BagIcon, ScooterIcon, ShopFrontIcon, WifiOffIcon } from "../ui/icons.js"
import { Button, EmptyState, Skeleton } from "../ui/primitives.js"

import { failToast } from "./shared.js"

import type { GuideAudience, GuideCount } from "@zumda/core"

const ICONS: Record<GuideAudience, React.JSX.Element> = {
    owner: <ShopFrontIcon size={22} />,
    courier: <ScooterIcon size={22} />,
    customer: <BagIcon size={22} />,
}

interface Progress {
    audience: GuideAudience
    done: number
    total: number
}

/** Presses «send» batch after batch until nobody of the audience is left; the totals at the end. */
async function sendAll(
    audience: GuideAudience,
    onBatch: (done: number) => void,
): Promise<{ sent: number; unreachable: number }> {
    let sent = 0
    let unreachable = 0
    for (;;) {
        const batch = await adminApi.sendGuides(audience)
        sent += batch.sent
        unreachable += batch.unreachable
        onBatch(sent + unreachable)
        if (batch.left === 0 || batch.sent + batch.unreachable === 0) {
            return { sent, unreachable }
        }
    }
}

/** Who still waits, everyone has it, or nobody is there yet. */
function guideLine(p: ReturnType<typeof useT>["platform"], count: GuideCount): string {
    if (count.total === 0) {
        return p.guidesNobody
    }
    return count.left === 0
        ? fill(p.guidesAllDone, { total: count.total })
        : fill(p.guideCounts, { left: count.left, total: count.total })
}

function GuideRow({
    count,
    progress,
    disabled,
    onSend,
}: {
    count: GuideCount
    progress: Progress | null
    disabled: boolean
    onSend(): void
}): React.JSX.Element {
    const p = useT().platform
    const label = progress
        ? fill(p.guidesProgress, { done: progress.done, total: progress.total })
        : p.guidesSend
    return (
        <li className="flex items-center gap-3 rounded-tile bg-tg-secondary p-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-brand/15 text-brand">
                {ICONS[count.audience]}
            </span>
            <div className="min-w-0 grow">
                <p className="font-semibold">{p.guideAudiences[count.audience]}</p>
                <p className="text-sm text-tg-hint">{guideLine(p, count)}</p>
            </div>
            {count.left > 0 ? (
                <Button
                    variant="surface"
                    className="shrink-0"
                    loading={progress !== null && progress.done === 0}
                    disabled={disabled}
                    onClick={onSend}
                >
                    {label}
                </Button>
            ) : null}
        </li>
    )
}

/**
 * «Qo'llanma»: everyone already in Zumda gets their role's guide video once, each from their
 * role's bot (owner's decision, October 2026). One press sends the whole audience, batch by batch.
 */
export function GuidesTab(): React.JSX.Element {
    const t = useT()
    const p = t.platform
    const [counts, setCounts] = useCachedState<GuideCount[]>("platform:guides")
    // The counts on screen for the loader: an error while they are shown is only a toast.
    const shown = useRef<GuideCount[] | null>(counts)
    shown.current = counts
    const [error, setError] = useState<string | null>(null)
    const [progress, setProgress] = useState<Progress | null>(null)
    const load = useCallback(async (): Promise<void> => {
        setError(null)
        try {
            setCounts(await adminApi.guides())
        } catch (caught) {
            const code = caught instanceof ApiError ? caught.code : "generic"
            if (shown.current) {
                toast(errorText(t, code), "error")
            } else {
                setError(code)
            }
        }
    }, [setCounts, t])
    useEffect(() => {
        void load()
    }, [load])
    useRefresh(progress ? null : load)

    const send = async (count: GuideCount): Promise<void> => {
        const sure = await confirm(
            fill(p.guidesConfirm, { who: p.guideAudiences[count.audience], n: count.left }),
            { yes: p.guidesSend },
        )
        if (!sure) {
            return
        }
        setProgress({ audience: count.audience, done: 0, total: count.left })
        try {
            const result = await sendAll(count.audience, (done) =>
                setProgress({ audience: count.audience, done, total: count.left }),
            )
            haptic.success()
            toast(fill(p.guidesDone, result), "success")
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setProgress(null)
            await load()
        }
    }

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
    if (!counts) {
        return <Skeleton className="h-44 rounded-tile" />
    }
    return (
        <section className="flex flex-col gap-3" aria-label={p.tabs.guides}>
            <p className="text-sm text-tg-hint">{p.guidesHint}</p>
            <ul className="flex flex-col gap-3">
                {counts.map((count) => (
                    <GuideRow
                        key={count.audience}
                        count={count}
                        progress={progress?.audience === count.audience ? progress : null}
                        disabled={progress !== null}
                        onSend={(): void => void send(count)}
                    />
                ))}
            </ul>
        </section>
    )
}

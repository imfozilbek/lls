import { useCallback, useEffect, useState } from "react"

import { fill, useT } from "../i18n/index.js"
import { adminApi } from "../lib/api.js"
import { confirm, haptic } from "../lib/telegram.js"
import { useCachedState } from "../lib/use-cached.js"
import { toast } from "../stores/toast.js"
import { CheckIcon, PhoneIcon } from "../ui/icons.js"
import { Button } from "../ui/primitives.js"

import { failToast } from "./shared.js"

import type { PhoneAskCount } from "@zumda/core"

interface Progress {
    done: number
    total: number
}

/** Who a missing phone stops now; loaded with «Bizneslar», refreshed by its pull. */
export function usePhoneAsks(): {
    counts: PhoneAskCount[] | null
    reload(): Promise<void>
} {
    const [counts, setCounts] = useCachedState<PhoneAskCount[]>("platform:phone-asks")
    const reload = useCallback(async (): Promise<void> => {
        try {
            setCounts(await adminApi.phoneAsks())
        } catch {
            // Only a helper above the list: the list itself shows a failed connection.
        }
    }, [setCounts])
    useEffect(() => {
        void reload()
    }, [reload])
    return { counts, reload }
}

/** Presses «ask» batch after batch until nobody is left for today; the totals at the end. */
async function askAll(onBatch: (done: number) => void): Promise<{
    sent: number
    unreachable: number
}> {
    let sent = 0
    let unreachable = 0
    for (;;) {
        const batch = await adminApi.askPhones()
        sent += batch.sent
        unreachable += batch.unreachable
        onBatch(sent + unreachable)
        if (batch.left === 0 || batch.sent + batch.unreachable === 0) {
            return { sent, unreachable }
        }
    }
}

/**
 * «Raqamsiz» above the live shops (owner's decision, October 2026): owners whose shop has no
 * number and couriers without a phone, and «Raqam so'rash»: each gets one button in their role's
 * bot, at most once a day. Gone while everyone has a phone.
 */
export function PhoneAskCard({
    counts,
    onDone,
}: {
    counts: PhoneAskCount[]
    onDone(): Promise<void>
}): React.JSX.Element | null {
    const t = useT()
    const p = t.platform
    const [progress, setProgress] = useState<Progress | null>(null)
    // The last round's count stays on the card: «yetmadi» is something to act on later.
    const [result, setResult] = useState<string | null>(null)
    const people = counts.filter((count) => count.total > 0)
    if (people.length === 0) {
        return null
    }
    const left = counts.reduce((sum, count) => sum + count.left, 0)

    const ask = async (): Promise<void> => {
        const sure = await confirm(fill(p.phoneAskConfirm, { n: left }), { yes: p.phoneAskSend })
        if (!sure) {
            return
        }
        setProgress({ done: 0, total: left })
        try {
            const result = await askAll((done) => setProgress({ done, total: left }))
            haptic.success()
            const line = fill(p.phoneAskDone, result)
            setResult(line)
            toast(line, "success")
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setProgress(null)
            await onDone()
        }
    }

    return (
        <section
            aria-label={p.phoneAskTitle}
            className="flex flex-col gap-3 rounded-tile bg-warning/15 p-4"
        >
            <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-tg-bg text-warning">
                    <PhoneIcon size={22} />
                </span>
                <div className="min-w-0">
                    <p className="font-semibold">{p.phoneAskTitle}</p>
                    <p className="text-sm tabular-nums text-tg-subtitle">
                        {people
                            .map(
                                (count) => `${p.phoneAskAudiences[count.audience]}: ${count.total}`,
                            )
                            .join(" · ")}
                    </p>
                </div>
            </div>
            <p className="text-sm text-tg-subtitle">{p.phoneAskHint}</p>
            {result ? <p className="text-sm font-medium">{result}</p> : null}
            {left > 0 ? (
                <Button
                    variant="primary"
                    loading={progress !== null && progress.done === 0}
                    disabled={progress !== null}
                    onClick={(): void => void ask()}
                >
                    {progress
                        ? fill(p.guidesProgress, { done: progress.done, total: progress.total })
                        : p.phoneAskSend}
                </Button>
            ) : (
                <p className="flex items-center gap-2 text-sm font-medium">
                    <CheckIcon size={18} className="shrink-0 text-success" />
                    {p.phoneAskToday}
                </p>
            )}
        </section>
    )
}

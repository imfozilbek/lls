import { BusinessStatus } from "@zumda/core"
import { useCallback, useEffect, useRef, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, adminApi } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { formatTime } from "../lib/format.js"
import { useRefresh } from "../lib/refresh.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { CheckIcon, StoreIcon, WifiOffIcon } from "../ui/icons.js"
import {
    Button,
    EmptyState,
    Field,
    Segmented,
    Skeleton,
    Switch,
    TextInput,
} from "../ui/primitives.js"
import { Sheet } from "../ui/sheet.js"

import { OwnerLine, ShopHead, botToast, useBusy } from "./shared.js"

import type { PlatformShopDTO } from "@zumda/core"

/** One list of «Platforma»: loads, reloads after an action, remembers its error. */
function useShops(status: BusinessStatus): {
    shops: PlatformShopDTO[] | null
    error: string | null
    reload(): Promise<void>
} {
    const [shops, setShops] = useState<PlatformShopDTO[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const reload = useCallback(async (): Promise<void> => {
        setError(null)
        try {
            setShops(await adminApi.shops(status))
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "generic")
        }
    }, [status])
    useEffect(() => {
        setShops(null)
        void reload()
    }, [reload])
    useRefresh(reload)
    return { shops, error, reload }
}

/** The shop a bot message pointed at: outlined and scrolled into view once. */
function useFocus(focused: boolean): React.RefObject<HTMLLIElement | null> {
    const ref = useRef<HTMLLIElement | null>(null)
    useEffect(() => {
        if (focused) {
            ref.current?.scrollIntoView({ block: "center", behavior: "smooth" })
        }
    }, [focused])
    return ref
}

/** «Rad etish» / «O'chirish»: one more tap, with what happens next. */
function ConfirmSheet({
    title,
    hint,
    action,
    busy,
    onConfirm,
    onClose,
    askReason = false,
}: {
    title: string
    hint: string
    action: string
    busy: boolean
    /** `reason`: what the admin typed when `askReason` is on. */
    onConfirm(reason?: string): void
    onClose(): void
    /** A rejected application says why: the owner fixes exactly that. */
    askReason?: boolean
}): React.JSX.Element {
    const p = useT().platform
    const [reason, setReason] = useState("")
    return (
        <Sheet title={title} onClose={onClose}>
            <p className="px-1 text-tg-subtitle">{hint}</p>
            {askReason ? (
                <Field label={p.rejectReason} htmlFor="reject-reason">
                    <TextInput
                        id="reject-reason"
                        value={reason}
                        maxLength={300}
                        placeholder={p.rejectReasonPlaceholder}
                        onChange={(e): void => setReason(e.target.value)}
                    />
                </Field>
            ) : null}
            <Button
                variant="danger"
                size="lg"
                loading={busy}
                onClick={(): void => onConfirm(reason.trim() || undefined)}
            >
                {action}
            </Button>
        </Sheet>
    )
}

function ApplicationCard({
    shop,
    focused,
    onDone,
}: {
    shop: PlatformShopDTO
    focused: boolean
    onDone(): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const ref = useFocus(focused)
    const { busy, run } = useBusy()
    const [confirming, setConfirming] = useState(false)
    const review = (decision: "approve" | "reject", reason?: string): Promise<void> =>
        run(decision, async () => {
            const result = await adminApi.review(shop.id, decision, reason)
            const done = decision === "approve" ? t.platform.approved : t.platform.rejected
            botToast(t, result, fill(done, { shop: shop.name }))
            setConfirming(false)
            onDone()
        })
    return (
        <li
            ref={ref}
            className={cn(
                "flex animate-rise flex-col gap-3 rounded-tile bg-tg-secondary p-4",
                focused && "ring-2 ring-brand",
            )}
        >
            <ShopHead shop={shop} />
            <OwnerLine shop={shop} />
            <p className="flex flex-wrap items-center gap-2 px-1 text-sm text-tg-hint">
                {fill(t.platform.applied, { date: formatTime(shop.createdAt, language) })}
                {shop.managedBot ? (
                    <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-tg-text">
                        {t.platform.managedBot}
                    </span>
                ) : null}
            </p>
            <div className="flex gap-2">
                <Button
                    className="grow"
                    loading={busy === "approve"}
                    disabled={busy !== null}
                    icon={<CheckIcon size={18} />}
                    onClick={(): void => void review("approve")}
                >
                    {t.platform.approve}
                </Button>
                <Button
                    variant="danger"
                    className="grow"
                    disabled={busy !== null}
                    onClick={(): void => setConfirming(true)}
                >
                    {t.platform.reject}
                </Button>
            </div>
            {confirming ? (
                <ConfirmSheet
                    title={fill(t.platform.rejectConfirm, { shop: shop.name })}
                    hint={t.platform.rejectHint}
                    action={t.platform.reject}
                    busy={busy === "reject"}
                    askReason
                    onConfirm={(reason): void => void review("reject", reason)}
                    onClose={(): void => setConfirming(false)}
                />
            ) : null}
        </li>
    )
}

/** "5" or "2,5": the percent the admin typed, or null when it is not a number. */
function parsePercent(text: string): number | null {
    const value = Number(text.trim().replace(",", "."))
    return text.trim() !== "" && Number.isFinite(value) && value >= 0 && value < 100
        ? Math.round(value * 100) / 100
        : null
}

function percentText(bps: number | undefined): string {
    return bps === undefined ? "" : String(bps / 100).replace(".", ",")
}

/** The showcase deal: on or off, and the commission on goods sold through it. */
function ShowcaseBlock({
    shop,
    onDone,
}: {
    shop: PlatformShopDTO
    onDone(): void
}): React.JSX.Element {
    const t = useT()
    const { busy, run } = useBusy()
    const [on, setOn] = useState(shop.marketplace !== undefined)
    const [percent, setPercent] = useState(percentText(shop.marketplace?.commissionBps ?? 500))
    const value = parsePercent(percent)
    const save = (next: number | null): Promise<void> =>
        run("showcase", async () => {
            await adminApi.marketplace(shop.id, next)
            haptic.success()
            toast(next === null ? t.platform.showcaseOff : t.platform.showcaseSaved, "success")
            onDone()
        })
    const changed =
        value !== null &&
        percentText(Math.round(value * 100)) !== percentText(shop.marketplace?.commissionBps)
    return (
        <div className="flex flex-col gap-3 rounded-control bg-tg-bg p-3">
            <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{t.platform.showcase}</span>
                <Switch
                    checked={on}
                    label={t.platform.showcase}
                    onChange={(next): void => {
                        setOn(next)
                        if (!next && shop.marketplace) {
                            void save(null)
                        }
                    }}
                />
            </div>
            {on ? (
                <Field
                    label={t.platform.commission}
                    hint={t.platform.commissionHint}
                    htmlFor={`commission-${shop.id}`}
                >
                    <div className="flex gap-2">
                        <TextInput
                            id={`commission-${shop.id}`}
                            inputMode="decimal"
                            value={percent}
                            maxLength={5}
                            onChange={(e): void => setPercent(e.target.value)}
                            aria-invalid={value === null}
                        />
                        <Button
                            className="shrink-0"
                            loading={busy === "showcase"}
                            disabled={
                                value === null || (!changed && shop.marketplace !== undefined)
                            }
                            onClick={(): void => void save(value)}
                        >
                            {t.common.save}
                        </Button>
                    </div>
                </Field>
            ) : null}
        </div>
    )
}

function LiveShopCard({
    shop,
    focused,
    onDone,
}: {
    shop: PlatformShopDTO
    focused: boolean
    onDone(): void
}): React.JSX.Element {
    const t = useT()
    const ref = useFocus(focused)
    const { busy, run } = useBusy()
    const [confirming, setConfirming] = useState(false)
    const live = shop.status === BusinessStatus.ACTIVE
    const reconnect = (): Promise<void> =>
        run("reconnect", async () => {
            botToast(t, await adminApi.reconnect(shop.id), t.platform.reconnected)
        })
    const review = (decision: "approve" | "reject"): Promise<void> =>
        run(decision, async () => {
            const result = await adminApi.review(shop.id, decision)
            const done = decision === "approve" ? t.platform.approved : t.platform.disabled
            botToast(t, result, fill(done, { shop: shop.name }))
            setConfirming(false)
            onDone()
        })
    return (
        <li
            ref={ref}
            className={cn(
                "flex animate-rise flex-col gap-3 rounded-tile bg-tg-secondary p-4",
                focused && "ring-2 ring-brand",
            )}
        >
            <ShopHead shop={shop} />
            <OwnerLine shop={shop} />
            {live ? <ShowcaseBlock shop={shop} onDone={onDone} /> : null}
            <div className="flex flex-wrap gap-2">
                {live ? (
                    <Button
                        variant="surface"
                        className="grow whitespace-nowrap"
                        loading={busy === "reconnect"}
                        onClick={(): void => void reconnect()}
                    >
                        {t.platform.reconnect}
                    </Button>
                ) : (
                    <Button
                        className="grow"
                        loading={busy === "approve"}
                        onClick={(): void => void review("approve")}
                    >
                        {t.platform.enable}
                    </Button>
                )}
                {live ? (
                    <Button
                        variant="danger"
                        className="grow whitespace-nowrap"
                        onClick={(): void => setConfirming(true)}
                    >
                        {t.platform.disable}
                    </Button>
                ) : null}
            </div>
            {confirming ? (
                <ConfirmSheet
                    title={fill(t.platform.disableConfirm, { shop: shop.name })}
                    hint={t.platform.disableHint}
                    action={t.platform.disable}
                    busy={busy === "reject"}
                    onConfirm={(): void => void review("reject")}
                    onClose={(): void => setConfirming(false)}
                />
            ) : null}
        </li>
    )
}

function ListState({
    error,
    onRetry,
}: {
    error: string | null
    onRetry(): void
}): React.JSX.Element {
    const t = useT()
    if (error) {
        return (
            <EmptyState
                art={<WifiOffIcon size={44} />}
                title={errorText(t, error)}
                action={
                    error === "ADMIN_ONLY" ? undefined : (
                        <Button variant="secondary" onClick={onRetry}>
                            {t.common.retry}
                        </Button>
                    )
                }
            />
        )
    }
    return (
        <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1].map((i) => (
                <Skeleton key={i} className="h-48 rounded-tile" />
            ))}
        </div>
    )
}

/** «Arizalar»: new businesses waiting for a yes or no. */
export function ApplicationsTab({
    focusId,
    onChanged,
    onFocusElsewhere,
}: {
    focusId: string | null
    onChanged(): void
    /** The shop a message pointed at is no longer an application: show it where it is now. */
    onFocusElsewhere(status: "active" | "disabled"): void
}): React.JSX.Element {
    const t = useT().platform
    const { shops, error, reload } = useShops(BusinessStatus.PENDING)
    const looked = useRef(false)
    useEffect(() => {
        if (!focusId || shops === null || looked.current) {
            return
        }
        looked.current = true
        if (shops.some((shop) => shop.id === focusId)) {
            return
        }
        adminApi
            .shops(BusinessStatus.DISABLED)
            .then((off) =>
                onFocusElsewhere(off.some((shop) => shop.id === focusId) ? "disabled" : "active"),
            )
            .catch(() => onFocusElsewhere("active"))
    }, [focusId, shops, onFocusElsewhere])
    if (shops === null) {
        return <ListState error={error} onRetry={(): void => void reload()} />
    }
    if (shops.length === 0) {
        return (
            <EmptyState
                art={<CheckIcon size={44} />}
                title={t.noApplications}
                text={t.noApplicationsText}
            />
        )
    }
    return (
        <ul className="flex flex-col gap-3">
            {shops.map((shop) => (
                <ApplicationCard
                    key={shop.id}
                    shop={shop}
                    focused={shop.id === focusId}
                    onDone={(): void => {
                        void reload()
                        onChanged()
                    }}
                />
            ))}
        </ul>
    )
}

type ShopsFilter = "active" | "disabled"

/** «Bizneslar»: live shops (showcase, bot, turn off) and turned-off ones (turn back on). */
export function ShopsTab({
    focusId,
    initialFilter,
}: {
    focusId: string | null
    initialFilter: ShopsFilter
}): React.JSX.Element {
    const t = useT().platform
    const [filter, setFilter] = useState<ShopsFilter>(initialFilter)
    const status = filter === "active" ? BusinessStatus.ACTIVE : BusinessStatus.DISABLED
    const { shops, error, reload } = useShops(status)
    let body: React.JSX.Element
    if (shops === null) {
        body = <ListState error={error} onRetry={(): void => void reload()} />
    } else if (shops.length === 0) {
        body = <EmptyState art={<StoreIcon size={44} />} title={t.noShops} />
    } else {
        body = (
            <ul className="flex flex-col gap-3">
                {shops.map((shop) => (
                    <LiveShopCard
                        key={`${shop.id}:${shop.marketplace?.commissionBps ?? "off"}`}
                        shop={shop}
                        focused={shop.id === focusId}
                        onDone={(): void => void reload()}
                    />
                ))}
            </ul>
        )
    }
    return (
        <div className="flex flex-col gap-4">
            <Segmented<ShopsFilter>
                value={filter}
                onChange={setFilter}
                options={[
                    { value: "active", label: t.live },
                    { value: "disabled", label: t.off },
                ]}
            />
            {body}
        </div>
    )
}

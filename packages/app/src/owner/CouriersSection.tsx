import { CourierStatus, WEEKDAYS, formatPhone } from "@zumda/core"
import { useEffect, useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { confirm, haptic, openTelegramLink } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { AlertIcon, CheckIcon, CopyIcon, PlusIcon, ScooterIcon, TrashIcon } from "../ui/icons.js"
import { Button, Section, Skeleton, Switch } from "../ui/primitives.js"

import { useOwner } from "./store.js"

import type { CourierInvite } from "../lib/api.js"
import type { CourierDTO, ShopOwnerDTO, Weekday } from "@zumda/core"

function failToast(t: ReturnType<typeof useT>, caught: unknown): void {
    haptic.error()
    toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
}

/** A fresh one-time link: sent straight to a chat, or copied. */
function InviteCard({
    invite,
    shopName,
}: {
    invite: CourierInvite
    shopName: string
}): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    const [copied, setCopied] = useState(false)
    const share = (): void => {
        const text = fill(s.inviteText, { shop: shopName })
        const url = `https://t.me/share/url?url=${encodeURIComponent(invite.link)}&text=${encodeURIComponent(text)}`
        haptic.tap()
        openTelegramLink(url)
    }
    const copy = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(invite.link)
            haptic.success()
            setCopied(true)
        } catch {
            toast(invite.link)
        }
    }
    return (
        <div className="flex animate-rise flex-col gap-3 rounded-tile bg-brand/10 p-4">
            <p className="break-all font-medium">{invite.link}</p>
            <div className="flex flex-wrap gap-2">
                <Button className="grow whitespace-nowrap" onClick={share}>
                    {s.inviteShare}
                </Button>
                <Button
                    variant="surface"
                    className="grow whitespace-nowrap"
                    icon={copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
                    onClick={(): void => void copy()}
                >
                    {copied ? s.copied : s.copy}
                </Button>
            </div>
            <p className="text-sm text-tg-hint">{s.inviteHint}</p>
        </div>
    )
}

/** Mon…Sun chips: tap a day to switch the courier on or off for it, like the menu's stop-list. */
function DayChips({
    days,
    onChange,
}: {
    days: readonly Weekday[]
    onChange(days: Weekday[]): void
}): React.JSX.Element {
    const s = useT().owner.settings
    return (
        <div role="group" aria-label={s.workDays} className="flex gap-1.5">
            {WEEKDAYS.map((day, index) => {
                const on = days.includes(day)
                const toggle = (): void => {
                    const next = on ? days.filter((d) => d !== day) : [...days, day]
                    // A courier works at least one day; removing them is the trash button.
                    if (next.length === 0) {
                        haptic.error()
                        return
                    }
                    haptic.select()
                    onChange(WEEKDAYS.filter((d) => next.includes(d)))
                }
                return (
                    <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        onClick={toggle}
                        className={cn(
                            "tap h-11 min-w-0 flex-1 rounded-control text-sm font-semibold transition-colors duration-200 ease-out-quart",
                            on ? "bg-brand text-brand-ink" : "bg-tg-bg text-tg-hint",
                        )}
                    >
                        {s.days[index]}
                    </button>
                )
            })}
        </div>
    )
}

function CourierAvatar({ courier }: { courier: CourierDTO }): React.JSX.Element {
    return (
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
            <ScooterIcon size={20} />
            {courier.onShift ? (
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-tg-bg p-0.5">
                    <span className="block h-full w-full animate-pulse rounded-full bg-success" />
                </span>
            ) : null}
        </span>
    )
}

function CourierContacts({ courier }: { courier: CourierDTO }): React.JSX.Element {
    const s = useT().owner.settings
    return (
        <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{courier.name}</span>
            <span className="flex flex-wrap gap-x-2 text-sm text-tg-hint">
                {courier.phone ? (
                    <a
                        href={`tel:${courier.phone}`}
                        className="-my-2 inline-flex items-center py-2 font-medium text-tg-link active:opacity-70"
                    >
                        {formatPhone(courier.phone)}
                    </a>
                ) : null}
                {courier.vehicle ? <span className="truncate">{courier.vehicle}</span> : null}
                {courier.isActive ? (
                    <span className="inline-flex items-center gap-1">
                        <span
                            aria-hidden
                            className={cn(
                                "h-2 w-2 rounded-full",
                                courier.onShift ? "bg-success" : "bg-tg-hint/50",
                            )}
                        />
                        {courier.onShift ? s.onShift : s.notOnShift}
                    </span>
                ) : null}
            </span>
        </span>
    )
}

/** Someone accepted the invite in the courier bot: the owner lets them in, or not. */
function PendingRow({
    courier,
    onReview,
}: {
    courier: CourierDTO
    onReview(approve: boolean): Promise<void>
}): React.JSX.Element {
    const s = useT().owner.settings
    const [busy, setBusy] = useState<"approve" | "decline" | null>(null)
    const review = async (approve: boolean): Promise<void> => {
        setBusy(approve ? "approve" : "decline")
        await onReview(approve)
        setBusy(null)
    }
    return (
        <li className="flex animate-rise flex-col gap-3 py-3">
            <span className="flex items-center gap-3">
                <CourierAvatar courier={courier} />
                <CourierContacts courier={courier} />
            </span>
            <span className="flex gap-2">
                <Button
                    className="grow"
                    loading={busy === "approve"}
                    disabled={busy !== null}
                    onClick={(): void => void review(true)}
                >
                    {s.approve}
                </Button>
                <Button
                    variant="surface"
                    className="grow"
                    loading={busy === "decline"}
                    disabled={busy !== null}
                    onClick={(): void => void review(false)}
                >
                    {s.decline}
                </Button>
            </span>
        </li>
    )
}

/** An approved courier: contacts, shift, working days, "not today", remove. */
function CourierRow({
    courier,
    onSchedule,
    onRemove,
}: {
    courier: CourierDTO
    onSchedule(patch: { workDays?: Weekday[]; offToday?: boolean }): void
    onRemove(): void
}): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    return (
        <li className="flex flex-col gap-3 py-3">
            <span className="flex items-center gap-3">
                <CourierAvatar courier={courier} />
                <CourierContacts courier={courier} />
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={`${t.common.delete}: ${courier.name}`}
                    className="tap grid h-11 w-11 shrink-0 place-items-center rounded-full text-tg-destructive"
                >
                    <TrashIcon size={18} />
                </button>
            </span>
            <DayChips
                days={courier.workDays}
                onChange={(workDays): void => onSchedule({ workDays })}
            />
            <label className="flex items-center justify-between gap-3">
                <span className={cn("text-sm", courier.offToday && "font-medium")}>
                    {s.offToday}
                </span>
                <Switch
                    checked={courier.offToday}
                    onChange={(offToday): void => onSchedule({ offToday })}
                    label={`${s.offToday}: ${courier.name}`}
                />
            </label>
        </li>
    )
}

interface CourierActions {
    review(courier: CourierDTO, approve: boolean): Promise<void>
    schedule(
        courier: CourierDTO,
        patch: { workDays?: Weekday[]; offToday?: boolean },
    ): Promise<void>
    remove(courier: CourierDTO): Promise<void>
}

function useCourierActions(): CourierActions {
    const t = useT()
    const s = t.owner.settings
    const loadCouriers = useOwner((state) => state.loadCouriers)
    const replaceCourier = useOwner((state) => state.replaceCourier)

    const review = async (courier: CourierDTO, approve: boolean): Promise<void> => {
        try {
            await api.owner.reviewCourier(courier.id, approve)
            await loadCouriers()
            haptic.success()
            if (approve) {
                toast(s.approved)
            }
        } catch (caught) {
            failToast(t, caught)
            await loadCouriers().catch(() => undefined)
        }
    }

    const schedule = async (
        courier: CourierDTO,
        patch: { workDays?: Weekday[]; offToday?: boolean },
    ): Promise<void> => {
        // Optimistic: the chip flips at once, the server answer settles it.
        replaceCourier({ ...courier, ...patch })
        try {
            replaceCourier(await api.owner.setCourierSchedule(courier.id, patch))
        } catch (caught) {
            failToast(t, caught)
            replaceCourier(courier)
        }
    }

    const remove = async (courier: CourierDTO): Promise<void> => {
        if (!(await confirm(`${s.removeCourier}\n${courier.name}`))) {
            return
        }
        try {
            await api.owner.removeCourier(courier.id)
            await loadCouriers()
            haptic.success()
        } catch (caught) {
            failToast(t, caught)
        }
    }

    return { review, schedule, remove }
}

/** «Если мои заняты, отдавать сети района»: on by default; the owner may switch it off. */
export function NetworkSection({
    shop,
    onSaved,
}: {
    shop: ShopOwnerDTO
    onSaved(shop: ShopOwnerDTO): void
}): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    const [value, setValue] = useState(shop.networkDelivery)
    const change = async (next: boolean): Promise<void> => {
        setValue(next)
        try {
            onSaved(await api.owner.updateShop({ networkDelivery: next }))
        } catch (caught) {
            setValue(!next)
            failToast(t, caught)
        }
    }
    return (
        <Section title={s.networkTitle}>
            <div className="flex flex-col gap-2 rounded-tile bg-tg-secondary p-4">
                <label className="flex items-center gap-3">
                    <span className="flex-1">
                        <span className="block font-semibold">{s.networkSwitch}</span>
                        <span className="text-sm text-tg-hint">{s.networkHint}</span>
                    </span>
                    <Switch
                        checked={value}
                        onChange={(next): void => void change(next)}
                        label={s.networkSwitch}
                    />
                </label>
                {shop.inDistrict ? null : (
                    <p className="flex gap-2 text-sm font-medium">
                        <AlertIcon size={18} className="shrink-0 text-warning" />
                        {s.notInDistrict}
                    </p>
                )}
            </div>
        </Section>
    )
}

/** The shop's couriers: invite by link, approve who joined, set their days, remove. */
export function CouriersSection({ shopName }: { shopName: string }): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    const couriers = useOwner((state) => state.couriers)
    const loadCouriers = useOwner((state) => state.loadCouriers)
    const pending = couriers?.filter((courier) => courier.status === CourierStatus.PENDING) ?? []
    const active = couriers?.filter((courier) => courier.isActive) ?? []
    const [invite, setInvite] = useState<CourierInvite | null>(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        const reload = (): void => void loadCouriers().catch(() => undefined)
        reload()
        // A courier joins in the bot while the owner is away: refresh when the app comes back.
        document.addEventListener("visibilitychange", reload)
        return (): void => document.removeEventListener("visibilitychange", reload)
    }, [loadCouriers])

    const create = async (): Promise<void> => {
        setBusy(true)
        try {
            setInvite(await api.owner.inviteCourier())
            haptic.success()
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setBusy(false)
        }
    }

    const { review, schedule, remove } = useCourierActions()

    return (
        <Section>
            <p className="px-1 text-sm text-tg-hint">{s.couriersHint}</p>
            {couriers === null ? <Skeleton className="h-14" /> : null}
            {pending.length > 0 ? (
                <div className="flex flex-col gap-2">
                    <h3 className="px-1 text-sm font-semibold text-brand">{s.pendingTitle}</h3>
                    <ul className="divide-y divide-tg-separator rounded-tile bg-brand/10 px-4">
                        {pending.map((courier) => (
                            <PendingRow
                                key={courier.id}
                                courier={courier}
                                onReview={(approve): Promise<void> => review(courier, approve)}
                            />
                        ))}
                    </ul>
                </div>
            ) : null}
            {active.length > 0 ? (
                <ul className="divide-y divide-tg-separator rounded-tile bg-tg-secondary px-4">
                    {active.map((courier) => (
                        <CourierRow
                            key={courier.id}
                            courier={courier}
                            onSchedule={(patch): void => void schedule(courier, patch)}
                            onRemove={(): void => void remove(courier)}
                        />
                    ))}
                </ul>
            ) : null}
            {invite ? <InviteCard invite={invite} shopName={shopName} /> : null}
            <Button
                variant="secondary"
                icon={<PlusIcon size={18} />}
                loading={busy}
                onClick={(): void => void create()}
            >
                {s.invite}
            </Button>
        </Section>
    )
}

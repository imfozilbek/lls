import { formatPhone } from "@lls/core"
import { useEffect, useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { confirm, haptic, openTelegramLink } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { CheckIcon, CopyIcon, PlusIcon, ScooterIcon, TrashIcon } from "../ui/icons.js"
import { Button, Section, Skeleton } from "../ui/primitives.js"

import { useOwner } from "./store.js"

import type { CourierInvite } from "../lib/api.js"
import type { CourierDTO } from "@lls/core"

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
            <div className="flex gap-2">
                <Button className="flex-1" onClick={share}>
                    {s.inviteShare}
                </Button>
                <Button
                    variant="secondary"
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

function CourierRow({
    courier,
    onRemove,
}: {
    courier: CourierDTO
    onRemove(): void
}): React.JSX.Element {
    const t = useT()
    return (
        <li className="flex items-center gap-3 py-2.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                <ScooterIcon size={20} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{courier.name}</span>
                {courier.phone ? (
                    <a href={`tel:${courier.phone}`} className="text-sm text-tg-link">
                        {formatPhone(courier.phone)}
                    </a>
                ) : null}
            </span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={`${t.common.delete}: ${courier.name}`}
                className="tap grid h-11 w-11 place-items-center rounded-full text-tg-destructive"
            >
                <TrashIcon size={18} />
            </button>
        </li>
    )
}

/** The shop's own couriers: invite by link, see who joined, remove. */
export function CouriersSection({ shopName }: { shopName: string }): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    const couriers = useOwner((state) => state.couriers)
    const loadCouriers = useOwner((state) => state.loadCouriers)
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

    return (
        <Section title={s.couriers}>
            <p className="px-1 text-sm text-tg-hint">{s.couriersHint}</p>
            {couriers === null ? <Skeleton className="h-14" /> : null}
            {couriers && couriers.length > 0 ? (
                <ul className="divide-y divide-tg-separator rounded-tile bg-tg-secondary px-4">
                    {couriers.map((courier) => (
                        <CourierRow
                            key={courier.id}
                            courier={courier}
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

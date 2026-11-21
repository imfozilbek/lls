import { useEffect, useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { useRefresh } from "../lib/refresh.js"
import { confirm, haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { Button, Skeleton, Spinner } from "../ui/primitives.js"

import { ChannelPosts } from "./ChannelPosts.js"
import { channelApi } from "./channel-api.js"
import { MegaphoneIcon } from "./channel-icons.js"
import { channelFailToast, useShopChannel } from "./channel-state.js"

import type { ChannelInfo } from "./channel-api.js"
import type { ShopChannelState } from "./channel-state.js"
import type { ShopOwnerDTO } from "@zumda/core"

/** «Kanalni bog'lash» and, while the owner is on Telegram's screen, that the app is waiting. */
export function ConnectChannel({ state }: { state: ShopChannelState }): React.JSX.Element {
    const c = useT().owner.channel
    return (
        <div className="flex flex-col gap-3">
            <Button
                size="lg"
                loading={state.connecting}
                icon={<MegaphoneIcon size={20} />}
                onClick={(): void => void state.connect()}
            >
                {c.connect}
            </Button>
            {state.waiting ? (
                <p
                    className="flex animate-fade-in items-center gap-2 rounded-control bg-brand/10 p-3 text-sm"
                    role="status"
                >
                    <Spinner className="shrink-0 text-brand" />
                    {c.waiting}
                </p>
            ) : (
                <p className="px-1 text-sm text-tg-hint">{c.connectHint}</p>
            )}
        </div>
    )
}

function NotConnected({
    shop,
    state,
}: {
    shop: ShopOwnerDTO
    state: ShopChannelState
}): React.JSX.Element {
    const t = useT()
    const c = t.owner.channel
    if (shop.demo) {
        return (
            <p className="rounded-tile bg-tg-secondary p-4 text-sm text-tg-subtitle">
                {errorText(t, "DEMO_NOT_PROMOTED")}
            </p>
        )
    }
    return (
        <section className="flex animate-rise flex-col gap-4 rounded-tile bg-tg-secondary p-4">
            <span className="grid h-12 w-12 place-items-center rounded-control bg-brand/15 text-brand">
                <MegaphoneIcon size={26} />
            </span>
            <p>{c.intro}</p>
            <ConnectChannel state={state} />
            <p className="px-1 text-sm text-tg-hint">{c.alreadyAdmin}</p>
        </section>
    )
}

function ChannelCard({ info }: { info: ChannelInfo }): React.JSX.Element {
    const c = useT().owner.channel
    const facts = [
        info.username ? `@${info.username}` : null,
        info.subscribers === null ? null : fill(c.subscribers, { n: String(info.subscribers) }),
    ].filter(Boolean)
    return (
        <section className="flex animate-rise items-center gap-4 rounded-tile bg-tg-secondary p-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
                <MegaphoneIcon size={24} />
            </span>
            <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold">{info.title}</h2>
                {facts.length > 0 ? (
                    <p className="truncate text-sm text-tg-hint">{facts.join(" · ")}</p>
                ) : null}
            </div>
        </section>
    )
}

/**
 * «Telegram kanal» in «Sozlamalar» (owner's decision, November 2026): the shop's bot becomes the
 * channel's admin from Telegram's own screen; then every product goes to the channel with one
 * button, every post there gets «Buyurtma berish», and each says how many came, ordered and got it.
 */
export function ChannelGroup({ shop }: { shop: ShopOwnerDTO }): React.JSX.Element {
    const t = useT()
    const c = t.owner.channel
    const state = useShopChannel()
    const { info, load } = state
    const [leaving, setLeaving] = useState(false)
    // Once on opening (a copy from this session shows meanwhile); the pull asks again.
    useEffect(() => {
        load().catch((caught: unknown) => channelFailToast(t, caught))
    }, [load, t])
    useRefresh(load)
    const disconnect = async (): Promise<void> => {
        const options = { yes: c.disconnect, destructive: true }
        if (!(await confirm(c.disconnectConfirm, options))) {
            return
        }
        setLeaving(true)
        try {
            await channelApi.disconnect()
            state.set(null)
            haptic.success()
            toast(c.disconnected, "success")
        } catch (caught) {
            channelFailToast(t, caught)
        } finally {
            setLeaving(false)
        }
    }
    if (info === undefined) {
        return <Skeleton className="h-40 rounded-tile" />
    }
    if (info === null) {
        return <NotConnected shop={shop} state={state} />
    }
    return (
        <>
            <ChannelCard info={info} />
            <ChannelPosts info={info} reloadChannel={load} setInfo={state.set} />
            <Button
                variant="quietDanger"
                className="self-start"
                loading={leaving}
                onClick={(): void => void disconnect()}
            >
                {c.disconnect}
            </Button>
        </>
    )
}

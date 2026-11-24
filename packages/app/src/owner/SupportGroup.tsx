import { useCallback, useEffect, useRef, useState } from "react"

import { errorText, useT } from "../i18n/index.js"
import { ApiError, request } from "../lib/api.js"
import { usePolling } from "../lib/polling.js"
import { useRefresh } from "../lib/refresh.js"
import { confirm, haptic, openTelegramLink } from "../lib/telegram.js"
import { useCachedState } from "../lib/use-cached.js"
import { toast } from "../stores/toast.js"
import { Button, Skeleton, Spinner } from "../ui/primitives.js"
import { ChatIcon } from "../ui/write-shop.js"

import type { ShopOwnerDTO } from "@zumda/core"

/** The connected group as the owner sees it. */
export interface SupportGroupInfo {
    title: string
    connectedAt: string
}

/** The session cache key of the group: «Sozlamalar» shows its name from it. */
export const SUPPORT_CACHE_KEY = "owner-support"

/** While Telegram's own screen is open, the group is looked for this often, and this long. */
const WAIT_POLL_MS = 15_000
const WAIT_FOR_MS = 5 * 60_000

const supportApi = {
    group: (): Promise<{ group: SupportGroupInfo | null }> => request("GET", "/api/owner/support"),
    /** The shop's bot hears the group from now on; `url` opens Telegram's own screen. */
    connect: (): Promise<{ url: string }> => request("POST", "/api/owner/support/connect"),
    disconnect: (): Promise<void> => request("DELETE", "/api/owner/support"),
}

function failToast(t: ReturnType<typeof useT>, caught: unknown): void {
    haptic.error()
    toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
}

interface SupportState {
    /** `undefined`: not known yet; `null`: none connected. */
    info: SupportGroupInfo | null | undefined
    load(): Promise<void>
    connect(): Promise<void>
    connecting: boolean
    /** The owner is on Telegram's screen: the group shows here the moment it is connected. */
    waiting: boolean
    set(info: SupportGroupInfo | null): void
}

/**
 * The group as the owner last saw it this session. Telegram tells the shop's bot, not the app,
 * when the bot joins the group: while the owner is on Telegram's screen the app asks every 15 s
 * (and on coming back), for five minutes at most.
 */
function useSupportGroup(): SupportState {
    const t = useT()
    const [cached, setCached] = useCachedState<{ info: SupportGroupInfo | null }>(SUPPORT_CACHE_KEY)
    const [connecting, setConnecting] = useState(false)
    const [waitingSince, setWaitingSince] = useState<number | null>(null)
    const info = cached?.info
    const set = useCallback(
        (next: SupportGroupInfo | null) => setCached({ info: next }),
        [setCached],
    )
    const load = useCallback(async (): Promise<void> => {
        const { group } = await supportApi.group()
        set(group)
    }, [set])
    const waiting = waitingSince !== null && info === null
    usePolling(() => load().catch(() => undefined), WAIT_POLL_MS, waiting)
    useEffect(() => {
        if (waitingSince === null) {
            return undefined
        }
        const timer = window.setTimeout(
            () => setWaitingSince(null),
            Math.max(0, waitingSince + WAIT_FOR_MS - Date.now()),
        )
        return (): void => window.clearTimeout(timer)
    }, [waitingSince])
    const announced = useRef(false)
    useEffect(() => {
        if (waitingSince !== null && info && !announced.current) {
            announced.current = true
            setWaitingSince(null)
            haptic.success()
            toast(t.owner.support.connected, "success")
        }
    }, [info, waitingSince, t])
    const connect = async (): Promise<void> => {
        setConnecting(true)
        try {
            const { url } = await supportApi.connect()
            announced.current = false
            setWaitingSince(Date.now())
            haptic.tap()
            openTelegramLink(url)
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setConnecting(false)
        }
    }
    return { info, load, connect, connecting, waiting, set }
}

/** What to do in Telegram first: a group of the shop's people, with topics on. */
function Steps(): React.JSX.Element {
    const s = useT().owner.support
    return (
        <ol className="flex flex-col gap-2">
            {s.steps.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-brand-ink">
                        {index + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                </li>
            ))}
        </ol>
    )
}

function NotConnected({
    shop,
    state,
}: {
    shop: ShopOwnerDTO
    state: SupportState
}): React.JSX.Element {
    const s = useT().owner.support
    if (shop.demo) {
        return <p className="rounded-tile bg-tg-secondary p-4 text-sm text-tg-subtitle">{s.demo}</p>
    }
    return (
        <section className="flex animate-rise flex-col gap-4 rounded-tile bg-tg-secondary p-4">
            <span className="grid h-12 w-12 place-items-center rounded-control bg-brand/15 text-brand">
                <ChatIcon size={26} />
            </span>
            <p>{s.intro}</p>
            <Steps />
            <Button
                size="lg"
                loading={state.connecting}
                icon={<ChatIcon size={20} />}
                onClick={(): void => void state.connect()}
            >
                {s.connect}
            </Button>
            {state.waiting ? (
                <p
                    className="flex animate-fade-in items-center gap-2 rounded-control bg-brand/10 p-3 text-sm"
                    role="status"
                >
                    <Spinner className="shrink-0 text-brand" />
                    {s.waiting}
                </p>
            ) : (
                <p className="px-1 text-sm text-tg-hint">{s.connectHint}</p>
            )}
            <p className="px-1 text-sm text-tg-hint">{s.alreadyIn}</p>
        </section>
    )
}

/**
 * «Mijozlar savollari» in «Sozlamalar» (owner's decision, November 2026; goal 21): the shop's
 * closed group with topics, connected from Telegram's own screen. A customer's message to the
 * shop's bot comes to their own topic there; an answer in the topic goes back from the shop's bot.
 */
export function SupportGroup({ shop }: { shop: ShopOwnerDTO }): React.JSX.Element {
    const t = useT()
    const s = t.owner.support
    const state = useSupportGroup()
    const { info, load } = state
    const [leaving, setLeaving] = useState(false)
    useEffect(() => {
        load().catch((caught: unknown) => failToast(t, caught))
    }, [load, t])
    useRefresh(load)
    const disconnect = async (): Promise<void> => {
        if (!(await confirm(s.disconnectConfirm, { yes: s.disconnect, destructive: true }))) {
            return
        }
        setLeaving(true)
        try {
            await supportApi.disconnect()
            state.set(null)
            haptic.success()
            toast(s.disconnected, "success")
        } catch (caught) {
            failToast(t, caught)
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
            <section className="flex animate-rise items-center gap-4 rounded-tile bg-tg-secondary p-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
                    <ChatIcon size={24} />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-semibold">{info.title}</h2>
                    <p className="text-sm text-tg-hint">{s.card}</p>
                </div>
            </section>
            <p className="px-1 text-sm text-tg-hint">{s.replyHint}</p>
            <Button
                variant="quietDanger"
                className="self-start"
                loading={leaving}
                onClick={(): void => void disconnect()}
            >
                {s.disconnect}
            </Button>
        </>
    )
}

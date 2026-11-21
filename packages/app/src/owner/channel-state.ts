import { useCallback, useEffect, useRef, useState } from "react"

import { errorText, useT } from "../i18n/index.js"
import { ApiError } from "../lib/api.js"
import { usePolling } from "../lib/polling.js"
import { haptic, openTelegramLink } from "../lib/telegram.js"
import { useCachedState } from "../lib/use-cached.js"
import { toast } from "../stores/toast.js"

import { channelApi } from "./channel-api.js"

import type { ChannelInfo } from "./channel-api.js"

/** While Telegram's own screen is open, the channel is looked for this often, and this long. */
const WAIT_POLL_MS = 15_000
const WAIT_FOR_MS = 5 * 60_000

export interface ShopChannelState {
    /** `undefined`: not known yet; `null`: none connected. */
    info: ChannelInfo | null | undefined
    load(): Promise<void>
    /** «Kanalni bog'lash»: the shop's bot is told to listen, then Telegram's screen opens. */
    connect(): Promise<void>
    connecting: boolean
    /** The owner is on Telegram's screen: the channel shows here the moment it is connected. */
    waiting: boolean
    /** The channel as it is now (after «Kanalni ajratish»: none). */
    set(info: ChannelInfo | null): void
}

function failToast(t: ReturnType<typeof useT>, caught: unknown): void {
    haptic.error()
    toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
}

/**
 * The shop's channel as the owner last saw it this session. Telegram tells the shop's bot, not
 * the app, when the bot becomes the channel's admin: while the owner is on Telegram's screen the
 * app asks every 15 s (and on coming back), for five minutes at most.
 */
export function useShopChannel(): ShopChannelState {
    const t = useT()
    const [cached, setCached] = useCachedState<{ info: ChannelInfo | null }>("owner-channel")
    const [connecting, setConnecting] = useState(false)
    const [waitingSince, setWaitingSince] = useState<number | null>(null)
    const info = cached?.info
    const set = useCallback((next: ChannelInfo | null) => setCached({ info: next }), [setCached])
    const load = useCallback(async (): Promise<void> => {
        const { channel } = await channelApi.channel()
        set(channel)
    }, [set])
    const waiting = waitingSince !== null && info === null
    usePolling(() => load().catch(() => undefined), WAIT_POLL_MS, waiting)
    // Five minutes on: the owner left Telegram's screen without connecting, the asking stops.
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
    // The channel came while waiting: said once, the way any finished step is.
    const announced = useRef(false)
    useEffect(() => {
        if (waitingSince !== null && info && !announced.current) {
            announced.current = true
            setWaitingSince(null)
            haptic.success()
            toast(t.owner.channel.connected, "success")
        }
    }, [info, waitingSince, t])
    const connect = async (): Promise<void> => {
        setConnecting(true)
        try {
            const { url } = await channelApi.connect()
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

export { failToast as channelFailToast }

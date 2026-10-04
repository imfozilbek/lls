import { useEffect, useRef } from "react"
import { create } from "zustand"

import { brandHex, brandInkHex } from "./brand.js"
import { hasNativeMainButton, webApp } from "./telegram.js"

export interface MainAction {
    text: string
    onClick(): void
    loading?: boolean
    disabled?: boolean
}

interface MainActionState {
    action: MainAction | null
    set(action: MainAction | null): void
}

/** The screen's one primary action. Rendered by <BottomBar/> when Telegram has no native button. */
export const useMainActionStore = create<MainActionState>((set) => ({
    action: null,
    set: (action): void => set({ action }),
}))

/**
 * Declares the screen's primary action. Inside Telegram it drives the native MainButton
 * (thumb zone, brand color); elsewhere <BottomBar/> draws an equivalent button.
 */
export function useMainAction(action: MainAction | null): void {
    const handler = useRef<() => void>(() => undefined)
    handler.current = action?.onClick ?? ((): void => undefined)
    const text = action?.text
    const loading = action?.loading ?? false
    const disabled = action?.disabled ?? false
    const visible = action !== null

    useEffect(() => {
        const click = (): void => handler.current()
        const native = hasNativeMainButton()
        const button = webApp()?.MainButton
        if (!visible) {
            useMainActionStore.getState().set(null)
            button?.setParams({ is_visible: false })
            return undefined
        }
        useMainActionStore.getState().set({ text: text ?? "", onClick: click, loading, disabled })
        if (native && button) {
            button.setParams({
                text,
                color: brandHex(),
                text_color: brandInkHex(),
                is_visible: true,
                is_active: !disabled && !loading,
            })
            if (loading) {
                button.showProgress(false)
            } else {
                button.hideProgress()
            }
            button.onClick(click)
        }
        return (): void => {
            button?.offClick(click)
            if (native) {
                button?.hideProgress()
                button?.setParams({ is_visible: false })
            }
            useMainActionStore.getState().set(null)
        }
    }, [visible, text, loading, disabled])
}

/** Outside Telegram (Zumda | Business in a browser) there is no BackButton: the app draws one. */
interface WebBackState {
    onBack: (() => void) | null
    set(onBack: (() => void) | null): void
}

export const useWebBackStore = create<WebBackState>((set) => ({
    onBack: null,
    set: (onBack): void => set({ onBack }),
}))

interface BackEntry {
    /** Render order of the owner: a screen inside another one always outranks it. */
    rank: number
    handler: { current: () => void }
}

/** Everyone who wants "back" now; only the innermost (highest rank) one gets the press. */
const backStack: BackEntry[] = []
let nextRank = 0
let nativeBound = false

function pressBack(): void {
    const top = backStack.reduce<BackEntry | undefined>(
        (best, entry) => (!best || entry.rank > best.rank ? entry : best),
        undefined,
    )
    top?.handler.current()
}

function syncBackButton(): void {
    const visible = backStack.length > 0
    const button = webApp()?.BackButton
    if (!button) {
        useWebBackStore.getState().set(visible ? pressBack : null)
        return
    }
    if (!nativeBound) {
        button.onClick(pressBack)
        nativeBound = true
    }
    if (visible) {
        button.show()
    } else {
        button.hide()
    }
}

/**
 * Shows Telegram's BackButton while `onBack` is set. Screens nest (a sheet over a screen, a part
 * of «Sozlamalar» inside the owner's section): one press goes only to the innermost of them.
 */
export function useBackButton(onBack: (() => void) | null): void {
    const handler = useRef<() => void>(() => undefined)
    handler.current = onBack ?? ((): void => undefined)
    const rank = useRef<number | null>(null)
    if (rank.current === null) {
        rank.current = nextRank++
    }
    const visible = onBack !== null
    useEffect(() => {
        if (!visible) {
            return
        }
        const entry: BackEntry = { rank: rank.current ?? 0, handler }
        backStack.push(entry)
        syncBackButton()
        return (): void => {
            backStack.splice(backStack.indexOf(entry), 1)
            syncBackButton()
        }
    }, [visible])
}

/** Screens with something to lose right now; while any, Telegram asks before closing the app. */
let closingGuards = 0

function syncClosingConfirmation(): void {
    const app = webApp()
    if (!app?.isVersionAtLeast("6.2")) {
        return
    }
    if (closingGuards > 0) {
        app.enableClosingConfirmation?.()
    } else {
        app.disableClosingConfirmation?.()
    }
}

/**
 * While `active`, closing the Mini App (swipe, ✕) asks first: a filled checkout, unsaved
 * settings, an application halfway, a picked receipt. Several screens may hold it at once.
 */
export function useClosingGuard(active: boolean): void {
    useEffect(() => {
        if (!active) {
            return undefined
        }
        closingGuards++
        syncClosingConfirmation()
        return (): void => {
            closingGuards--
            syncClosingConfirmation()
        }
    }, [active])
}

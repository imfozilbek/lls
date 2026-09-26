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

/** Shows Telegram's BackButton while `onBack` is set. */
export function useBackButton(onBack: (() => void) | null): void {
    const handler = useRef<() => void>(() => undefined)
    handler.current = onBack ?? ((): void => undefined)
    const visible = onBack !== null
    useEffect(() => {
        const button = webApp()?.BackButton
        if (!button) {
            return undefined
        }
        const click = (): void => handler.current()
        if (visible) {
            button.show()
            button.onClick(click)
        } else {
            button.hide()
        }
        return (): void => button.offClick(click)
    }, [visible])
}

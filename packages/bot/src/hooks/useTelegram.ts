import { useSignal, backButton, mainButton, themeParams } from "@telegram-apps/sdk-react"
import { useEffect, useCallback } from "react"

interface TelegramUser {
    id: number
    first_name: string
    last_name?: string
    username?: string
    language_code?: string
    is_premium?: boolean
}

export function useTelegramUser(): TelegramUser | null {
    if (typeof window === "undefined") {
        return null
    }

    const user = window.Telegram?.WebApp?.initDataUnsafe?.user
    return (user as TelegramUser | undefined) ?? null
}

export function useThemeParams(): {
    bgColor: string
    textColor: string
    hintColor: string
    linkColor: string
    buttonColor: string
    buttonTextColor: string
    secondaryBgColor: string
} {
    const params = useSignal(themeParams.state)

    return {
        bgColor: params["bgColor"] || "#ffffff",
        textColor: params["textColor"] || "#000000",
        hintColor: params["hintColor"] || "#999999",
        linkColor: params["linkColor"] || "#2481cc",
        buttonColor: params["buttonColor"] || "#2481cc",
        buttonTextColor: params["buttonTextColor"] || "#ffffff",
        secondaryBgColor: params["secondaryBgColor"] || "#f0f0f0",
    }
}

export function useBackButton(
    onClick?: () => void,
    visible = true,
): {
    show: () => void
    hide: () => void
} {
    useEffect(() => {
        if (!backButton.isMounted()) {
            return undefined
        }

        if (visible && onClick) {
            backButton.show()
            const off = backButton.onClick(onClick)
            return (): void => {
                off()
                backButton.hide()
            }
        } else {
            backButton.hide()
            return undefined
        }
    }, [onClick, visible])

    const show = useCallback((): void => {
        if (backButton.isMounted()) {
            backButton.show()
        }
    }, [])

    const hide = useCallback((): void => {
        if (backButton.isMounted()) {
            backButton.hide()
        }
    }, [])

    return { show, hide }
}

export function useMainButton(
    text: string,
    onClick?: () => void,
    options?: {
        visible?: boolean
        disabled?: boolean
        loading?: boolean
    },
): {
    show: () => void
    hide: () => void
    enable: () => void
    disable: () => void
} {
    const { visible = true, disabled = false, loading = false } = options || {}

    useEffect(() => {
        if (!mainButton.isMounted()) {
            return undefined
        }

        mainButton.setParams({
            text,
            isVisible: visible,
            isEnabled: !disabled && !loading,
        })

        if (onClick && visible && !disabled && !loading) {
            const off = mainButton.onClick(onClick)
            return off
        }

        return undefined
    }, [text, onClick, visible, disabled, loading])

    const show = useCallback((): void => {
        if (mainButton.isMounted()) {
            mainButton.setParams({ isVisible: true })
        }
    }, [])

    const hide = useCallback((): void => {
        if (mainButton.isMounted()) {
            mainButton.setParams({ isVisible: false })
        }
    }, [])

    const enable = useCallback((): void => {
        if (mainButton.isMounted()) {
            mainButton.setParams({ isEnabled: true })
        }
    }, [])

    const disable = useCallback((): void => {
        if (mainButton.isMounted()) {
            mainButton.setParams({ isEnabled: false })
        }
    }, [])

    return { show, hide, enable, disable }
}

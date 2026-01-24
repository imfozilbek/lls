import {
    init,
    miniApp,
    themeParams,
    viewport,
    backButton,
    mainButton,
} from "@telegram-apps/sdk-react"

import { logger } from "./logger.js"

const log = logger.child("telegram")

export function initTelegram(): void {
    try {
        init()
        miniApp.mount()
        themeParams.mount()
        void viewport.mount()
        backButton.mount()
        mainButton.mount()

        void viewport.expand()
    } catch (error) {
        log.error("Failed to initialize Telegram SDK", { error })
    }
}

export function hapticFeedback(type: "light" | "medium" | "heavy" = "light"): void {
    try {
        if (typeof window !== "undefined" && window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type)
        }
    } catch {
        // Ignore haptic errors
    }
}

export function hapticNotification(type: "error" | "success" | "warning" = "success"): void {
    try {
        if (typeof window !== "undefined" && window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred(type)
        }
    } catch {
        // Ignore haptic errors
    }
}

export function closeMiniApp(): void {
    try {
        if (typeof window !== "undefined" && window.Telegram?.WebApp) {
            window.Telegram.WebApp.close()
        }
    } catch {
        // Ignore close errors
    }
}

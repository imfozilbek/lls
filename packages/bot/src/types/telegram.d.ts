interface TelegramUser {
    id: number
    first_name: string
    last_name?: string
    username?: string
    language_code?: string
    is_premium?: boolean
}

interface TelegramWebAppInitData {
    user?: TelegramUser
    query_id?: string
    auth_date?: number
    hash?: string
}

interface TelegramHapticFeedback {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void
    notificationOccurred: (type: "error" | "success" | "warning") => void
    selectionChanged: () => void
}

interface TelegramWebApp {
    initData: string
    initDataUnsafe: TelegramWebAppInitData
    version: string
    platform: string
    colorScheme: "light" | "dark"
    themeParams: Record<string, string>
    isExpanded: boolean
    viewportHeight: number
    viewportStableHeight: number
    HapticFeedback: TelegramHapticFeedback
    close: () => void
    expand: () => void
    ready: () => void
}

interface Window {
    Telegram?: {
        WebApp?: TelegramWebApp
    }
}

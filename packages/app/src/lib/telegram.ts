/** Thin typed wrapper over `window.Telegram.WebApp` (loaded by telegram-web-app.js, 0 KB bundle). */

interface WebAppUser {
    id: number
    first_name: string
    last_name?: string
    language_code?: string
}

interface BottomButton {
    setParams(params: {
        text?: string
        color?: string
        text_color?: string
        is_active?: boolean
        is_visible?: boolean
    }): void
    onClick(callback: () => void): void
    offClick(callback: () => void): void
    showProgress(leaveActive?: boolean): void
    hideProgress(): void
}

interface BackButtonApi {
    show(): void
    hide(): void
    onClick(callback: () => void): void
    offClick(callback: () => void): void
}

interface LocationData {
    latitude: number
    longitude: number
}

interface LocationManagerApi {
    isInited: boolean
    isLocationAvailable: boolean
    init(callback?: () => void): void
    getLocation(callback: (data: LocationData | null) => void): void
}

export interface WebApp {
    initData: string
    initDataUnsafe: { user?: WebAppUser; start_param?: string }
    version: string
    platform: string
    colorScheme: "light" | "dark"
    ready(): void
    expand(): void
    setHeaderColor?(color: string): void
    setBackgroundColor?(color: string): void
    setBottomBarColor?(color: string): void
    isVersionAtLeast(version: string): boolean
    MainButton: BottomButton
    BackButton: BackButtonApi
    HapticFeedback: {
        impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void
        notificationOccurred(type: "error" | "success" | "warning"): void
        selectionChanged(): void
    }
    LocationManager?: LocationManagerApi
    requestContact?(callback: (shared: boolean) => void): void
    requestWriteAccess?(callback: (allowed: boolean) => void): void
    showConfirm?(message: string, callback: (ok: boolean) => void): void
    openTelegramLink?(url: string): void
}

declare global {
    interface Window {
        Telegram?: { WebApp?: WebApp }
    }
}

export function webApp(): WebApp | null {
    const app = window.Telegram?.WebApp
    return app && app.initData ? app : null
}

/** The app's own surface: Telegram's header and bottom bar match it, even in a dark theme. */
export const LIGHT_SURFACE = "#ffffff"

/**
 * Always light (owner's decision): paint Telegram's frame around the app white too, so a dark
 * Telegram theme does not frame a light app. Older clients simply skip it.
 */
export function paintLightFrame(app: WebApp | null): void {
    if (!app?.isVersionAtLeast("6.1")) {
        return
    }
    app.setHeaderColor?.(LIGHT_SURFACE)
    app.setBackgroundColor?.(LIGHT_SURFACE)
    if (app.isVersionAtLeast("7.10")) {
        app.setBottomBarColor?.(LIGHT_SURFACE)
    }
}

/** The native bottom button exists only inside real Telegram clients. */
export function hasNativeMainButton(): boolean {
    const app = webApp()
    return app !== null && app.platform !== "unknown" && app.isVersionAtLeast("6.1")
}

export const haptic = {
    tap(): void {
        webApp()?.HapticFeedback.impactOccurred("light")
    },
    select(): void {
        webApp()?.HapticFeedback.selectionChanged()
    },
    success(): void {
        webApp()?.HapticFeedback.notificationOccurred("success")
    },
    error(): void {
        webApp()?.HapticFeedback.notificationOccurred("error")
    },
}

export interface LaunchParams {
    /** Shop slug from `?shop=` or `startapp=shop_<slug>`. */
    shop: string | null
    onboarding: boolean
    /** `?mode=courier`: the courier's deliveries across shops, opened from the Zumda courier bot. */
    courier: boolean
    /** `?mode=market`: the Zumda showcase, opened from the Zumda bot. */
    market: boolean
}

export function readLaunchParams(url: URL, app: WebApp | null): LaunchParams {
    const fromStart = app?.initDataUnsafe.start_param?.match(/^shop_([a-z0-9-]{3,40})$/)?.[1]
    return {
        shop: url.searchParams.get("shop") ?? fromStart ?? null,
        onboarding: url.searchParams.get("mode") === "onboarding",
        courier: url.searchParams.get("mode") === "courier",
        market: url.searchParams.get("mode") === "market",
    }
}

function callbackPromise<T>(start: (done: (value: T) => void) => void, fallback: T): Promise<T> {
    return new Promise((resolve) => {
        try {
            start(resolve)
        } catch {
            resolve(fallback)
        }
    })
}

/** Asks Telegram to share the user's phone with the shop bot. Resolves false if declined. */
export function requestContact(): Promise<boolean> {
    const app = webApp()
    if (!app?.requestContact) {
        return Promise.resolve(false)
    }
    const request = app.requestContact.bind(app)
    return callbackPromise((done) => request(done), false)
}

/** Lets the shop bot send order status messages. */
export function requestWriteAccess(): Promise<boolean> {
    const app = webApp()
    if (!app?.requestWriteAccess) {
        return Promise.resolve(false)
    }
    const request = app.requestWriteAccess.bind(app)
    return callbackPromise((done) => request(done), false)
}

export function getLocation(): Promise<LocationData | null> {
    const manager = webApp()?.LocationManager
    if (!manager) {
        return Promise.resolve(null)
    }
    return callbackPromise<LocationData | null>((done) => {
        const read = (): void => {
            if (!manager.isLocationAvailable) {
                done(null)
                return
            }
            manager.getLocation(done)
        }
        if (manager.isInited) {
            read()
        } else {
            manager.init(read)
        }
    }, null)
}

export function confirm(message: string): Promise<boolean> {
    const app = webApp()
    if (!app?.showConfirm || !app.isVersionAtLeast("6.2")) {
        return Promise.resolve(window.confirm(message))
    }
    const ask = app.showConfirm.bind(app)
    return callbackPromise((done) => ask(message, done), false)
}

export function openTelegramLink(url: string): void {
    const app = webApp()
    if (app?.openTelegramLink) {
        app.openTelegramLink(url)
    } else {
        window.open(url, "_blank", "noopener")
    }
}

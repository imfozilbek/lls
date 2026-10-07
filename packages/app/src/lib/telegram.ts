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
    /** 6.2: our own words on the buttons (showConfirm uses Telegram's language). */
    showPopup?(params: PopupParams, callback?: (buttonId: string) => void): void
    /** 7.7: a downward swipe no longer collapses the app (our pull-to-refresh owns it). */
    disableVerticalSwipes?(): void
    /** 6.2: Telegram asks before closing while there is something to lose. */
    enableClosingConfirmation?(): void
    disableClosingConfirmation?(): void
    /** 8.0: the app is collapsed or in the background while false. */
    isActive?: boolean
    onEvent?(event: string, handler: () => void): void
    offEvent?(event: string, handler: () => void): void
    /** 8.0: keeps the phone layout from turning sideways. */
    lockOrientation?(): void
    /** 8.0: the shop's icon on the phone's home screen. */
    addToHomeScreen?(): void
    checkHomeScreenStatus?(callback: (status: HomeScreenStatus) => void): void
    /** 9.1: closes the keyboard. */
    hideKeyboard?(): void
    openTelegramLink?(url: string): void
    /** 6.1: a link outside Telegram, in the phone's browser. */
    openLink?(url: string): void
    /** 8.0: Telegram's own "save the file" window. */
    downloadFile?(params: { url: string; file_name: string }): void
    /** Bot API 9.6: opens a prepared button's window, here «create a bot» (Managed Bots). */
    requestChat?(preparedId: string, callback?: (shared: boolean) => void): void
}

export interface PopupParams {
    title?: string
    message: string
    buttons: { id: string; type: "default" | "ok" | "cancel" | "destructive"; text?: string }[]
}

export type HomeScreenStatus = "unsupported" | "unknown" | "added" | "missed"

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
    warning(): void {
        webApp()?.HapticFeedback.notificationOccurred("warning")
    },
}

/**
 * One app, three addresses: business.zumda.shop opens «Mening bizneslarim», delivery.zumda.shop
 * the courier screen, app.zumda.shop the shops. Locally (one dev server) `?mode=` decides.
 */
const BUSINESS_HOST_PREFIX = "business."
const COURIER_HOST_PREFIX = "delivery."

/** What «Platforma» opens on, from a bot message: the applications, one shop, the districts. */
export type AdminTarget = "applications" | "districts" | { shopId: string }

const ID = /^[A-Za-z0-9-]{1,64}$/

function readAdminTarget(value: string | null): AdminTarget | null {
    if (value === "applications" || value === "districts") {
        return value
    }
    const shopId = value?.match(/^shop_([A-Za-z0-9-]{1,64})$/)?.[1]
    return shopId ? { shopId } : null
}

export interface LaunchParams {
    /** Shop slug from `?shop=` or `startapp=shop_<slug>`. */
    shop: string | null
    /** `?mode=business` (old buttons: `?mode=onboarding`): «Mening bizneslarim», Zumda Business. */
    business: boolean
    /** `?mode=courier`: the courier's deliveries across shops, opened from the Zumda courier bot. */
    courier: boolean
    /** `?mode=market`: the Zumda showcase, opened from the Zumda bot. */
    market: boolean
    /** `&order=<id>`: a bot message's «Buyurtmani ochish» opens this order. */
    order: string | null
    /** `&admin=…`: an admin's message opens «Platforma» on this. */
    admin: AdminTarget | null
}

/** `shop_<slug>`: the shop's own bot; `m_<slug>`: Zumda | Shop on that shop (its QR, goal 16). */
const START_SHOP = /^shop_([a-z0-9-]{3,40})$/
const START_MARKET_SHOP = /^m_([a-z0-9-]{3,40})$/

export function readLaunchParams(url: URL, app: WebApp | null): LaunchParams {
    const start = app?.initDataUnsafe.start_param ?? ""
    const fromStart = START_SHOP.exec(start)?.[1]
    // Zumda Shop's main Mini App may open without `?mode=market`: the prefix says it is.
    const marketShop = START_MARKET_SHOP.exec(start)?.[1]
    return {
        shop: url.searchParams.get("shop") ?? marketShop ?? fromStart ?? null,
        business:
            url.hostname.startsWith(BUSINESS_HOST_PREFIX) ||
            ["business", "onboarding"].includes(url.searchParams.get("mode") ?? ""),
        courier:
            url.hostname.startsWith(COURIER_HOST_PREFIX) ||
            url.searchParams.get("mode") === "courier",
        market: url.searchParams.get("mode") === "market" || marketShop !== undefined,
        order: ID.test(url.searchParams.get("order") ?? "") ? url.searchParams.get("order") : null,
        admin: readAdminTarget(url.searchParams.get("admin")),
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
/** Telegram before 6.9 cannot share a contact from a Mini App: the person must update it. */
export function canRequestContact(): boolean {
    const app = webApp()
    return Boolean(app?.requestContact) && (app?.isVersionAtLeast("6.9") ?? false)
}

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

/** Telegram apps from Bot API 9.6 open the «create a bot» window right inside the Mini App. */
export const REQUEST_CHAT_VERSION = "9.6"

export function canRequestChat(): boolean {
    const app = webApp()
    return Boolean(app?.requestChat && app.isVersionAtLeast(REQUEST_CHAT_VERSION))
}

/**
 * Opens the prepared «create a bot» window. Resolves true when the bot was created; false when the
 * owner closed it, or the app cannot do it (then the t.me/newbot link is the way).
 */
export function requestChat(preparedId: string): Promise<boolean> {
    const app = webApp()
    if (!app?.requestChat || !canRequestChat()) {
        return Promise.resolve(false)
    }
    const request = app.requestChat.bind(app)
    return callbackPromise((done) => request(preparedId, done), false)
}

/** business.zumda.shop in a browser: the browser's own location, if the person allows it. */
function browserLocation(): Promise<LocationData | null> {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        return Promise.resolve(null)
    }
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) =>
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 15_000 },
        )
    })
}

export function getLocation(): Promise<LocationData | null> {
    const manager = webApp()?.LocationManager
    if (!manager) {
        return webApp() ? Promise.resolve(null) : browserLocation()
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

export interface ConfirmOptions {
    /** The words on the yes button («Ha» by default). */
    yes?: string
    /** The words on the no button («Bekor qilish» by default). */
    no?: string
    /** The yes button is red: the action takes something away (cancel, remove). */
    destructive?: boolean
}

/** The words a popup uses when the caller gives none; set by the app from its dictionary. */
const popupWords = { yes: "Ha", no: "Bekor qilish" }

export function setPopupWords(words: { yes: string; no: string }): void {
    Object.assign(popupWords, words)
}

/**
 * Asks yes or no. Inside Telegram: its own popup with our Uzbek words (showConfirm would label
 * the buttons in Telegram's language) and a red button for what cannot be undone.
 */
export function confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    const app = webApp()
    if (app?.showPopup && app.isVersionAtLeast("6.2")) {
        const show = app.showPopup.bind(app)
        return callbackPromise(
            (done) =>
                show(
                    {
                        message,
                        buttons: [
                            { id: "no", type: "default", text: options.no ?? popupWords.no },
                            {
                                id: "yes",
                                type: options.destructive ? "destructive" : "default",
                                text: options.yes ?? popupWords.yes,
                            },
                        ],
                    },
                    (id) => done(id === "yes"),
                ),
            false,
        )
    }
    if (app?.showConfirm && app.isVersionAtLeast("6.2")) {
        const ask = app.showConfirm.bind(app)
        return callbackPromise((done) => ask(message, done), false)
    }
    return Promise.resolve(window.confirm(message))
}

/**
 * Once, at start: a downward swipe refreshes instead of collapsing the app, and the phone layout
 * stays upright. Older clients skip what they do not know.
 */
export function setUpNativeFeel(app: WebApp | null): void {
    if (app?.isVersionAtLeast("7.7")) {
        app.disableVerticalSwipes?.()
    }
    if (app?.isVersionAtLeast("8.0")) {
        app.lockOrientation?.()
    }
}

/** Closes the keyboard: Telegram's own call where it exists, else the field lets go of focus. */
export function hideKeyboard(): void {
    const app = webApp()
    if (app?.hideKeyboard && app.isVersionAtLeast("9.1")) {
        app.hideKeyboard()
        return
    }
    const active = document.activeElement
    if (active instanceof HTMLElement) {
        active.blur()
    }
}

/** 8.0: is the app on screen now (not collapsed, not in the background)? */
export function isAppActive(): boolean {
    const app = webApp()
    if (app?.isActive === false) {
        return false
    }
    return document.visibilityState === "visible"
}

/**
 * Runs `handler` whenever the app comes back on screen: Telegram's `activated` (8.0) and the
 * page's own visibility. Returns the unsubscribe.
 */
export function onAppActive(handler: () => void): () => void {
    const app = webApp()
    const onVisible = (): void => {
        if (isAppActive()) {
            handler()
        }
    }
    document.addEventListener("visibilitychange", onVisible)
    app?.onEvent?.("activated", handler)
    return (): void => {
        document.removeEventListener("visibilitychange", onVisible)
        app?.offEvent?.("activated", handler)
    }
}

/** 8.0: can the shop's icon still go to the phone's home screen? */
export function canAddToHomeScreen(): Promise<boolean> {
    const app = webApp()
    if (!app?.checkHomeScreenStatus || !app.addToHomeScreen || !app.isVersionAtLeast("8.0")) {
        return Promise.resolve(false)
    }
    const check = app.checkHomeScreenStatus.bind(app)
    return callbackPromise((done) => check((status) => done(status === "missed")), false)
}

export function addToHomeScreen(): void {
    webApp()?.addToHomeScreen?.()
}

/**
 * Saves a file (the QR poster): Telegram's own window from 8.0, the browser before it, and in a
 * plain browser (business.zumda.shop) a link the file's `Content-Disposition` turns into a save.
 */
export function downloadFile(url: string, fileName: string): void {
    const app = webApp()
    if (app?.downloadFile && app.isVersionAtLeast("8.0")) {
        app.downloadFile({ url, file_name: fileName })
        return
    }
    if (app?.openLink) {
        app.openLink(url)
        return
    }
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    link.rel = "noopener"
    document.body.append(link)
    link.click()
    link.remove()
}

/** The shop's bot opened on Start: once the owner presses it, orders and files come there. */
export function shopBotStartLink(botUsername: string): string {
    return `https://t.me/${botUsername}?start=owner`
}

export function openTelegramLink(url: string): void {
    const app = webApp()
    if (app?.openTelegramLink) {
        app.openTelegramLink(url)
    } else {
        window.open(url, "_blank", "noopener")
    }
}

/**
 * Opens the Mini App the way Telegram does: `window.Telegram.WebApp` with initData signed by
 * the bot that opened it. The real telegram-web-app.js is blocked; this stub answers instead
 * and does what Telegram would do (a shared contact goes to the bot's webhook).
 */
import { createHmac } from "node:crypto"

import { expect } from "@playwright/test"

import { APP_URL, businessBot, courierBot, platformBot, shopBySlug } from "../stand/config.js"

import { businessChat, courierChat, managedBotUpdate, platformChat, shopChat } from "./telegram.js"

import type { Chat, TgUser } from "./telegram.js"
import type { Page } from "@playwright/test"

/** Telegram's Bot API version that brought `WebApp.requestChat` (Managed Bots). */
const REQUEST_CHAT_VERSION = 9.6

export const YAKKABOG = { latitude: 38.9785, longitude: 66.6831 }

/** The query of a message's «open the app» button: open the app the way the button would. */
export function appQueryOf(buttons: { web_app?: { url: string } }[]): string {
    const url = buttons.find((b) => b.web_app)?.web_app?.url
    if (!url) {
        throw new Error("The message has no button to the app")
    }
    return new URL(url).search
}

const DARK_THEME = {
    bg_color: "#17212b",
    text_color: "#f5f5f5",
    hint_color: "#708499",
    link_color: "#6ab3f3",
    secondary_bg_color: "#232e3c",
    section_bg_color: "#17212b",
    section_separator_color: "#111921",
    destructive_text_color: "#ec3942",
    subtitle_text_color: "#708499",
}

/** initData exactly as Telegram signs it (HMAC with the bot token). */
export function signInitData(
    user: TgUser,
    botToken: string,
    extra: Record<string, string> = {},
): string {
    const params = new URLSearchParams({
        auth_date: String(Math.floor(Date.now() / 1000)),
        query_id: "AAE-e2e",
        user: JSON.stringify(user),
        ...extra,
    })
    const dataCheckString = [...params.entries()]
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join("\n")
    const secret = createHmac("sha256", "WebAppData").update(botToken).digest()
    params.set("hash", createHmac("sha256", secret).update(dataCheckString).digest("hex"))
    return params.toString()
}

export interface OpenOptions {
    user: TgUser
    /** Telegram's `startapp` value (e.g. `m_<slug>` of a Zumda Shop QR), signed into initData. */
    startParam?: string
    /** Opened from this shop's bot; without it, from the Zumda bot. */
    shop?: string
    /** Opened from the Zumda courier bot (`?mode=courier`), whatever `shop` says. */
    courierBot?: boolean
    /** Opened from the Zumda Business bot (`?mode=business`, «Mening bizneslarim»). */
    businessBot?: boolean
    /** Query string after `/`, e.g. `?mode=market`. Default: `?shop=<shop>`. */
    query?: string
    /** Sign with this token instead (forged identities, wrong bots). */
    signWith?: string
    /** Empty initData: the page was opened outside Telegram. */
    noInitData?: boolean
    /** Telegram's native MainButton instead of the in-app bottom bar. */
    native?: boolean
    theme?: "light" | "dark"
    /** What the person answers when the app asks for the phone. */
    contact?: "share" | "decline"
    /** The phone Telegram sends to the bot when the person shares the contact. */
    phone?: string
    location?: { latitude: number; longitude: number } | null
    confirm?: boolean
    writeAccess?: boolean
    /** Telegram's Bot API version (default 8.0); `requestChat` is there from 9.6. */
    version?: string
    /**
     * Telegram 9.6+: the bot the person creates in the «create a bot» window (`requestChat`);
     * absent: they close the window.
     */
    createsBot?: number
}

interface StubConfig {
    initData: string
    user: TgUser
    /** What Telegram puts in `initDataUnsafe`: the user and the `startapp` value. */
    unsafe: { user?: TgUser; start_param?: string }
    platform: string
    colorScheme: "light" | "dark"
    theme: Record<string, string> | null
    location: { latitude: number; longitude: number } | null
    confirm: boolean
    writeAccess: boolean
    contact: "share" | "decline"
    version: string
    createsBot: number | null
}

/** Like telegram-web-app.js: the theme becomes CSS variables on <html>. Runs in the page. */
function paintTheme(theme: Record<string, string>): void {
    const paint = (): void => {
        for (const [key, value] of Object.entries(theme)) {
            document.documentElement.style.setProperty(
                `--tg-theme-${key.replaceAll("_", "-")}`,
                value,
            )
        }
    }
    if (document.documentElement) {
        paint()
    } else {
        document.addEventListener("readystatechange", paint, { once: true })
    }
}

type Recorder = (
    method: string,
    result?: (...args: unknown[]) => unknown,
) => (...args: unknown[]) => unknown

/**
 * Bot API 6.2-9.1: closing confirmation, no vertical swipes, orientation, keyboard, home screen,
 * and Telegram's events. Part of the page stub: runs in the page, so it takes everything it uses.
 */
function nativeFeel(record: Recorder): { api: Record<string, unknown>; fire(event: string): void } {
    const events: Record<string, (() => void)[]> = {}
    const fire = (event: string): void => {
        const app = (window as unknown as { Telegram: { WebApp: { isActive: boolean } } }).Telegram
            .WebApp
        app.isActive = event !== "deactivated"
        for (const handler of events[event] ?? []) {
            handler()
        }
    }
    const api = {
        disableVerticalSwipes: record("disableVerticalSwipes"),
        enableClosingConfirmation: record("enableClosingConfirmation"),
        disableClosingConfirmation: record("disableClosingConfirmation"),
        lockOrientation: record("lockOrientation"),
        hideKeyboard: record("hideKeyboard"),
        addToHomeScreen: record("addToHomeScreen"),
        checkHomeScreenStatus: record("checkHomeScreenStatus", (callback) =>
            (callback as (status: string) => void)("missed"),
        ),
        isActive: true,
        onEvent: (event: string, handler: () => void): void => {
            events[event] = [...(events[event] ?? []), handler]
        },
        offEvent: (event: string, handler: () => void): void => {
            events[event] = (events[event] ?? []).filter((h) => h !== handler)
        },
    }
    return { api, fire }
}

/**
 * Speakers for the test: every bell the app rings is recorded as its frequency in
 * `window.__sounds` (G5 = 783.99 Hz is the "zum" of the Zumda sound). Runs in the page.
 */
function installAudioStub(): void {
    const played: number[] = []
    class Param {
        value = 0
        setValueAtTime(): this {
            return this
        }
        linearRampToValueAtTime(): this {
            return this
        }
        exponentialRampToValueAtTime(): this {
            return this
        }
    }
    class Node {
        connect<T>(next: T): T {
            return next
        }
    }
    class Oscillator extends Node {
        type = "sine"
        frequency = new Param()
        start(): void {
            played.push(this.frequency.value)
        }
        stop(): void {
            // Nothing to stop: the test only records what started.
        }
    }
    class Gain extends Node {
        gain = new Param()
    }
    class Context {
        currentTime = 0
        destination = new Node()
        resume(): Promise<void> {
            return Promise.resolve()
        }
        createOscillator(): Oscillator {
            return new Oscillator()
        }
        createGain(): Gain {
            return new Gain()
        }
    }
    Object.assign(window, { AudioContext: Context, __sounds: played })
}

/** Runs in the page before any app code. Records every call in `window.__tg`. */
function installTelegramStub(config: StubConfig): void {
    interface Handlers {
        params: Record<string, unknown>
        handlers: (() => void)[]
        visible: boolean
    }
    const button = (): Handlers & Record<string, unknown> => {
        const state: Handlers & Record<string, unknown> = {
            params: {},
            handlers: [],
            visible: false,
        }
        state["setParams"] = (params: Record<string, unknown>): void => {
            state.params = { ...state.params, ...params }
        }
        state["onClick"] = (handler: () => void): void => {
            state.handlers.push(handler)
        }
        state["offClick"] = (handler: () => void): void => {
            state.handlers = state.handlers.filter((h) => h !== handler)
        }
        state["show"] = (): void => {
            state.visible = true
        }
        state["hide"] = (): void => {
            state.visible = false
        }
        state["showProgress"] = (): void => undefined
        state["hideProgress"] = (): void => undefined
        return state
    }
    const calls: { method: string; args: unknown[] }[] = []
    const record =
        (method: string, result?: (...args: unknown[]) => unknown) =>
        (...args: unknown[]): unknown => {
            calls.push({ method, args })
            return result?.(...args)
        }
    const mainButton = button()
    const backButton = button()
    // Defined beside the stub and put in the page before it (`openApp`); `__tg.fire` plays
    // Telegram's own events (activated, deactivated) in a test.
    const native = (window as unknown as { __nativeFeel: typeof nativeFeel }).__nativeFeel(record)
    const webApp = {
        initData: config.initData,
        initDataUnsafe: config.unsafe,
        version: config.version,
        platform: config.platform,
        colorScheme: config.colorScheme,
        ready: record("ready"),
        expand: record("expand"),
        setHeaderColor: record("setHeaderColor"),
        setBackgroundColor: record("setBackgroundColor"),
        setBottomBarColor: record("setBottomBarColor"),
        isVersionAtLeast: (version: string): boolean => Number(version) <= Number(config.version),
        MainButton: mainButton,
        BackButton: backButton,
        HapticFeedback: {
            impactOccurred: record("haptic.impact"),
            notificationOccurred: record("haptic.notification"),
            selectionChanged: record("haptic.selection"),
        },
        LocationManager: {
            isInited: true,
            isLocationAvailable: config.location !== null,
            init: (callback?: () => void): void => callback?.(),
            getLocation: record("getLocation", (callback) =>
                (callback as (data: unknown) => void)(config.location),
            ),
        },
        requestContact: record("requestContact", (callback) => {
            const done = callback as (shared: boolean) => void
            if (config.contact === "decline") {
                done(false)
                return
            }
            void (window as unknown as { __shareContact: () => Promise<boolean> })
                .__shareContact()
                .then(done)
        }),
        requestWriteAccess: record("requestWriteAccess", (callback) =>
            (callback as (ok: boolean) => void)(config.writeAccess),
        ),
        showConfirm: record("showConfirm", (_message, callback) =>
            (callback as (ok: boolean) => void)(config.confirm),
        ),
        // The answer is the button the person would press: «yes» or «no».
        showPopup: record("showPopup", (_params, callback) =>
            (callback as (id: string) => void)(config.confirm ? "yes" : "no"),
        ),
        openTelegramLink: record("openTelegramLink"),
        downloadFile: record("downloadFile"),
        ...native.api,
    }
    const fire = native.fire
    Object.assign(window, {
        Telegram: { WebApp: webApp },
        __tg: { calls, mainButton, backButton, fire },
    })
}

/**
 * Telegram 9.6+ only: `requestChat` opens the «create a bot» window. Like Telegram, the bot is
 * created, the Zumda bot hears `managed_bot`, then the window closes and the app learns it.
 * Runs in the page after `installTelegramStub`.
 */
function installRequestChat(createsBot: number | null): void {
    const page = window as unknown as {
        Telegram: { WebApp: Record<string, unknown> }
        __tg: { calls: { method: string; args: unknown[] }[] }
        __createBot: (id: number) => Promise<boolean>
    }
    page.Telegram.WebApp["requestChat"] = (id: string, done: (created: boolean) => void): void => {
        page.__tg.calls.push({ method: "requestChat", args: [id] })
        if (createsBot === null) {
            done(false)
            return
        }
        void page.__createBot(createsBot).then(done)
    }
}

export interface OpenedApp {
    page: Page
    /** The bot chat the app was opened from (where a shared contact goes). */
    chat: Chat
    /** Telegram API calls the app made: requestContact, openTelegramLink, haptics… */
    calls(): Promise<{ method: string; args: unknown[] }[]>
    /** Presses Telegram's BackButton. */
    back(): Promise<void>
    /** Native MainButton: its current params, and a press. */
    mainButton(): Promise<Record<string, unknown>>
    pressMainButton(): Promise<void>
    /** Plays one of Telegram's events: the app collapsed («deactivated») or back («activated»). */
    fire(event: "activated" | "deactivated"): Promise<void>
    /** How many times the Zumda sound's "zum" (G5) has rung so far. */
    zums(): Promise<number>
}

function stubConfig(options: OpenOptions, initData: string): StubConfig {
    return {
        initData,
        user: options.user,
        unsafe: initData
            ? {
                  user: options.user,
                  ...(options.startParam ? { start_param: options.startParam } : {}),
              }
            : {},
        platform: options.native ? "android" : "unknown",
        colorScheme: options.theme ?? "light",
        theme: options.theme === "dark" ? DARK_THEME : null,
        location: options.location === undefined ? YAKKABOG : options.location,
        confirm: options.confirm ?? true,
        writeAccess: options.writeAccess ?? true,
        contact: options.contact ?? "share",
        version: options.version ?? "8.0",
        createsBot: options.createsBot ?? null,
    }
}

/** Per tab: where a shared contact goes now, and who creates a bot in the window. */
const opened = new WeakMap<
    Page,
    { share(): Promise<Response>; createBot(botId: number): Promise<Response> }
>()

/** The bot that opened the app: its token signs initData, its chat gets a shared contact. */
function openedFrom(options: OpenOptions): { token: string; chat: Chat; query: string } {
    if (options.courierBot) {
        return { token: courierBot().token, chat: courierChat(), query: "?mode=courier" }
    }
    if (options.businessBot) {
        return { token: businessBot().token, chat: businessChat(), query: "?mode=business" }
    }
    if (options.shop) {
        const shop = shopBySlug(options.shop)
        return { token: shop.bot.token, chat: shopChat(shop.slug), query: `?shop=${shop.slug}` }
    }
    return { token: platformBot().token, chat: platformChat(), query: "" }
}

export async function openApp(page: Page, options: OpenOptions): Promise<OpenedApp> {
    const { token: botToken, chat, query: defaultQuery } = openedFrom(options)
    const token = options.signWith ?? botToken
    const extra: Record<string, string> = options.startParam
        ? { start_param: options.startParam }
        : {}
    const initData = options.noInitData ? "" : signInitData(options.user, token, extra)
    const phone = options.phone ?? "+998901234567"

    const contact = {
        share: (): Promise<Response> => chat.shareContact(options.user, phone),
        createBot: (botId: number): Promise<Response> => managedBotUpdate(options.user, botId),
    }
    const known = opened.get(page)
    if (known) {
        // The same tab opened again (another user or shop): the stub follows the new one.
        known.share = contact.share
        known.createBot = contact.createBot
    } else {
        opened.set(page, contact)
        await page.route("https://telegram.org/**", (route) =>
            route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
        )
        await page.exposeFunction("__shareContact", async (): Promise<boolean> => {
            const response = await (opened.get(page)?.share() ??
                Promise.reject(new Error("closed")))
            return response.ok
        })
        await page.exposeFunction("__createBot", async (botId: number): Promise<boolean> => {
            const response = await (opened.get(page)?.createBot(botId) ??
                Promise.reject(new Error("closed")))
            return response.ok
        })
    }
    const config = stubConfig(options, initData)
    if (config.theme) {
        await page.addInitScript(paintTheme, config.theme)
    }
    await page.addInitScript(installAudioStub)
    await page.addInitScript(`window.__nativeFeel = ${nativeFeel.toString()}`)
    await page.addInitScript(installTelegramStub, config)
    if (Number(config.version) >= REQUEST_CHAT_VERSION) {
        await page.addInitScript(installRequestChat, config.createsBot)
    }
    if (options.theme === "dark") {
        await page.emulateMedia({ colorScheme: "dark" })
    }
    const query = options.query ?? defaultQuery
    await page.goto(`${APP_URL}/${query}`)

    const tg = (): Promise<{
        calls: { method: string; args: unknown[] }[]
        mainButton: { params: Record<string, unknown> }
    }> =>
        page.evaluate(() => {
            const state = (window as unknown as { __tg: Record<string, unknown> }).__tg
            const main = state["mainButton"] as { params: Record<string, unknown> }
            return {
                calls: state["calls"] as { method: string; args: unknown[] }[],
                mainButton: { params: main.params },
            }
        })

    return {
        page,
        chat,
        calls: async () => (await tg()).calls,
        mainButton: async () => (await tg()).mainButton.params,
        zums: () =>
            page.evaluate(
                () =>
                    (window as unknown as { __sounds: number[] }).__sounds.filter(
                        (hz) => Math.abs(hz - 783.99) < 0.01,
                    ).length,
            ),
        fire: (event) =>
            page.evaluate((name) => {
                ;(window as unknown as { __tg: { fire(event: string): void } }).__tg.fire(name)
            }, event),
        back: () =>
            page.evaluate(() => {
                const state = (
                    window as unknown as { __tg: { backButton: { handlers: (() => void)[] } } }
                ).__tg
                for (const handler of state.backButton.handlers) {
                    handler()
                }
            }),
        pressMainButton: () =>
            page.evaluate(() => {
                const state = (
                    window as unknown as { __tg: { mainButton: { handlers: (() => void)[] } } }
                ).__tg
                for (const handler of state.mainButton.handlers) {
                    handler()
                }
            }),
    }
}

/** The in-app bottom button (Telegram Web and old clients draw no native one). */
export function bottomButton(page: Page): ReturnType<Page["locator"]> {
    return page.locator("div.fixed.bottom-0 button")
}

/** «Sozlamalar» lists its parts with what is set in each: a tap on a part's name opens it. */
export async function openGroup(page: Page, group: string): Promise<void> {
    await page
        .getByRole("button")
        .filter({ has: page.getByText(group, { exact: true }) })
        .click()
    await expect(page.getByRole("heading", { name: group, exact: true, level: 1 })).toBeVisible()
}

/** The owner's «Sozlamalar» tab, opened on one part. */
export async function openSettings(page: Page, group: string): Promise<void> {
    await page.getByRole("tab", { name: "Sozlamalar" }).click()
    await openGroup(page, group)
}

/** From a part of «Sozlamalar» back to the list of parts. */
export async function settingsBack(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Sozlamalar", exact: true }).click()
}

/**
 * Our map's picker: «Xaritada belgilash» → «Joylashuvim» (the place Telegram gives) → «Shu yer».
 * `where` is that place (the stub's location of the person, Yakkabog' by default).
 */
export async function pickOnMap(
    page: Page,
    where: { latitude: number; longitude: number } = YAKKABOG,
    button: RegExp | string = "Xaritada belgilash",
): Promise<void> {
    await page.getByRole("button", { name: button }).click()
    const picker = page.locator("[role=dialog][data-point]")
    await expect(picker.locator(".zumda-map")).toHaveAttribute("data-map-ready", "true", {
        timeout: 20_000,
    })
    await picker.getByRole("button", { name: "Joylashuvim" }).click()
    await expect(picker).toHaveAttribute(
        "data-point",
        `${where.latitude.toFixed(4)},${where.longitude.toFixed(4)}`,
        { timeout: 10_000 },
    )
    await picker.getByRole("button", { name: "Shu yer" }).click()
    await expect(picker).toBeHidden()
}

/**
 * Opens the Mini App the way Telegram does: `window.Telegram.WebApp` with initData signed by
 * the bot that opened it. The real telegram-web-app.js is blocked; this stub answers instead
 * and does what Telegram would do (a shared contact goes to the bot's webhook).
 */
import { createHmac } from "node:crypto"

import { APP_URL, platformBot, shopBySlug } from "../stand/config.js"

import { llsChat, shopChat } from "./telegram.js"

import type { Chat, TgUser } from "./telegram.js"
import type { Page } from "@playwright/test"

export const GULISTAN = { latitude: 40.4897, longitude: 68.7842 }

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
    /** Opened from this shop's bot; without it, from the LLS bot. */
    shop?: string
    /** Query string after `/`, e.g. `?shop=osh-markaz-dev&mode=courier`. Default: `?shop=<shop>`. */
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
}

interface StubConfig {
    initData: string
    user: TgUser
    platform: string
    colorScheme: "light" | "dark"
    theme: Record<string, string> | null
    location: { latitude: number; longitude: number } | null
    confirm: boolean
    writeAccess: boolean
    contact: "share" | "decline"
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
    const webApp = {
        initData: config.initData,
        initDataUnsafe: config.initData ? { user: config.user } : {},
        version: "8.0",
        platform: config.platform,
        colorScheme: config.colorScheme,
        ready: record("ready"),
        expand: record("expand"),
        isVersionAtLeast: (version: string): boolean => Number(version) <= 8,
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
        openTelegramLink: record("openTelegramLink"),
    }
    Object.assign(window, {
        Telegram: { WebApp: webApp },
        __tg: { calls, mainButton, backButton },
    })
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
}

function stubConfig(options: OpenOptions, initData: string): StubConfig {
    return {
        initData,
        user: options.user,
        platform: options.native ? "android" : "unknown",
        colorScheme: options.theme ?? "light",
        theme: options.theme === "dark" ? DARK_THEME : null,
        location: options.location === undefined ? GULISTAN : options.location,
        confirm: options.confirm ?? true,
        writeAccess: options.writeAccess ?? true,
        contact: options.contact ?? "share",
    }
}

/** Per tab: where a shared contact goes now. */
const opened = new WeakMap<Page, { share(): Promise<Response> }>()

export async function openApp(page: Page, options: OpenOptions): Promise<OpenedApp> {
    const shop = options.shop ? shopBySlug(options.shop) : null
    const token = options.signWith ?? shop?.bot.token ?? platformBot().token
    const chat = shop ? shopChat(shop.slug) : llsChat()
    const initData = options.noInitData ? "" : signInitData(options.user, token)
    const phone = options.phone ?? "+998901234567"

    const contact = { share: (): Promise<Response> => chat.shareContact(options.user, phone) }
    const known = opened.get(page)
    if (known) {
        // The same tab opened again (another user or shop): the stub follows the new one.
        known.share = contact.share
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
    }
    const config = stubConfig(options, initData)
    if (config.theme) {
        await page.addInitScript(paintTheme, config.theme)
    }
    await page.addInitScript(installTelegramStub, config)
    if (options.theme === "dark") {
        await page.emulateMedia({ colorScheme: "dark" })
    }
    const query = options.query ?? (shop ? `?shop=${shop.slug}` : "")
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

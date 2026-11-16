import { NavApp, routeUrl } from "@zumda/core"

import { openOutside } from "./telegram.js"

import type { RoutePoint } from "@zumda/core"

/** A navigation app a route opens in. */
export interface NavAppEntry {
    id: NavApp
    /** The app's own name: never translated. */
    name: string
    /** Its official icon (App Store), in `public/nav-apps/`. */
    icon: string
}

const icon = (id: NavApp): string => `${import.meta.env.BASE_URL}nav-apps/${id}.webp`

/**
 * The apps a courier, a dispatcher or the owner opens a route in (owner's decision, November
 * 2026), in this order until one is picked: the one picked last then comes first.
 */
export const NAV_APPS: readonly NavAppEntry[] = [
    { id: NavApp.NAVIGATOR, name: "Yandex Navigator", icon: icon(NavApp.NAVIGATOR) },
    { id: NavApp.YANDEX_GO, name: "Yandex Go", icon: icon(NavApp.YANDEX_GO) },
    { id: NavApp.GOOGLE, name: "Google Maps", icon: icon(NavApp.GOOGLE) },
    { id: NavApp.TWO_GIS, name: "2GIS", icon: icon(NavApp.TWO_GIS) },
    { id: NavApp.YANDEX_MAPS, name: "Yandex Maps", icon: icon(NavApp.YANDEX_MAPS) },
]

const LAST_KEY = "zumda:nav-app"

function lastPicked(): string | null {
    try {
        return window.localStorage.getItem(LAST_KEY)
    } catch {
        return null
    }
}

/** Kept on this phone: the next route offers this app first. */
export function rememberNavApp(id: NavApp): void {
    try {
        window.localStorage.setItem(LAST_KEY, id)
    } catch {
        // Private mode: the order resets with the session.
    }
}

/** The apps that can take this route (one point, or several stops), the last picked first. */
export function navAppsFor(
    stops: readonly RoutePoint[],
    last: string | null = lastPicked(),
): { app: NavAppEntry; url: string }[] {
    const offered = NAV_APPS.flatMap((app) => {
        const url = routeUrl(app.id, stops)
        return url ? [{ app, url }] : []
    })
    const first = offered.find((entry) => entry.app.id === last)
    return first ? [first, ...offered.filter((entry) => entry !== first)] : offered
}

/**
 * An https link goes through Telegram, which hands it to the app that claims it; Navigator opens
 * only by its own scheme, which the phone hands to it.
 */
export function openNavApp(url: string): void {
    if (url.startsWith("https://")) {
        openOutside(url)
    } else {
        window.location.assign(url)
    }
}

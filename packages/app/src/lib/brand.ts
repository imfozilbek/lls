import { hexToRgbChannels } from "./format.js"

/** Relative luminance (WCAG) of an "r g b" channel string. */
function luminance(channels: string): number {
    const [r, g, b] = channels.split(" ").map((c) => {
        const v = Number(c) / 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

const WHITE = "255 255 255"
const INK = "17 24 39"

/** White or near-black text, whichever reads better on the brand color. */
export function readableInk(channels: string): string {
    const l = luminance(channels)
    const contrastWhite = 1.05 / (l + 0.05)
    const contrastInk = (l + 0.05) / (luminance(INK) + 0.05)
    return contrastWhite >= contrastInk ? WHITE : INK
}

/** LLS's own color: the showcase and onboarding, where no shop leads. */
export const LLS_BRAND_COLOR = "#0ea5e9"

/** Paints the shop's color into CSS variables and Telegram's chrome. */
export function applyBrand(hex: string): void {
    const channels = hexToRgbChannels(hex) ?? "14 165 233"
    const root = document.documentElement.style
    root.setProperty("--brand-rgb", channels)
    root.setProperty("--brand-ink-rgb", readableInk(channels))
}

export function brandHex(): string {
    const channels = getComputedStyle(document.documentElement)
        .getPropertyValue("--brand-rgb")
        .trim()
    const [r, g, b] = (channels || "14 165 233").split(" ").map(Number)
    return `#${[r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, "0")).join("")}`
}

export function brandInkHex(): string {
    const channels = getComputedStyle(document.documentElement)
        .getPropertyValue("--brand-ink-rgb")
        .trim()
    return channels === WHITE || channels === "" ? "#ffffff" : "#111827"
}

/** Shop colors owners can pick: the LLS palette, all readable with white or dark text. */
export const BRAND_SWATCHES = [
    "#0ea5e9",
    "#0284c7",
    "#10b981",
    "#059669",
    "#f59e0b",
    "#d97706",
    "#ef4444",
    "#dc2626",
] as const

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

/** The product's name: the showcase, the courier screen, the poster footer. */
export const ZUMDA_NAME = "Zumda"

/** Zumda's own color: the showcase and onboarding, where no shop leads; a new shop's color. */
export const ZUMDA_BRAND_COLOR = "#15803d"

/** The same green as CSS channels: the fallback when a color cannot be read. */
export const ZUMDA_BRAND_CHANNELS = "21 128 61"

/** The Zumda mark in a 120×120 box (`brand/zumda-mark.svg`): one drawing for React and canvas. */
export const ZUMDA_MARK = {
    box: 120,
    pin: "M60 14C38 14 24 30 24 50C24 76 60 106 60 106C60 106 96 76 96 50C96 30 82 14 60 14Z",
    roof: "M42 56L60 40L78 56",
    roofWidth: 6.5,
    door: { x: 51, y: 55, width: 18, height: 20, radius: 3 },
    green: "#15803d",
    mint: "#dcfce7",
    white: "#ffffff",
} as const

/** Paints the shop's color into CSS variables and Telegram's chrome. */
export function applyBrand(hex: string): void {
    const channels = hexToRgbChannels(hex) ?? ZUMDA_BRAND_CHANNELS
    const root = document.documentElement.style
    root.setProperty("--brand-rgb", channels)
    root.setProperty("--brand-ink-rgb", readableInk(channels))
}

export function brandHex(): string {
    const channels = getComputedStyle(document.documentElement)
        .getPropertyValue("--brand-rgb")
        .trim()
    const [r, g, b] = (channels || ZUMDA_BRAND_CHANNELS).split(" ").map(Number)
    return `#${[r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, "0")).join("")}`
}

export function brandInkHex(): string {
    const channels = getComputedStyle(document.documentElement)
        .getPropertyValue("--brand-ink-rgb")
        .trim()
    return channels === WHITE || channels === "" ? "#ffffff" : "#111827"
}

/** Shop colors owners can pick: the Zumda palette, all readable with white or dark text. */
export const BRAND_SWATCHES = [
    ZUMDA_BRAND_COLOR,
    "#0ea5e9",
    "#0284c7",
    "#10b981",
    "#059669",
    "#f59e0b",
    "#d97706",
    "#ef4444",
    "#dc2626",
] as const

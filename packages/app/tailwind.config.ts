import type { Config } from "tailwindcss"

type ColorFn = (options: { opacityValue?: string }) => string

/**
 * Telegram theme colors are hex values. Solid classes use the variable directly; opacity
 * modifiers (`bg-tg-hint/15`) go through color-mix. Without this Tailwind silently drops them.
 */
function tgColor(variable: string, fallback: string): ColorFn {
    const color = `var(${variable}, ${fallback})`
    return ({ opacityValue }) =>
        opacityValue === undefined || opacityValue === "1"
            ? color
            : `color-mix(in srgb, ${color} calc(${opacityValue} * 100%), transparent)`
}

/** Telegram theme variables carry light/dark; the shop's brand color is `--brand-rgb`. */
const config: Config = {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    // Opacity comes from `/NN` modifiers only, so solid theme colors stay plain `var()`.
    corePlugins: {
        backgroundOpacity: false,
        textOpacity: false,
        borderOpacity: false,
        divideOpacity: false,
        placeholderOpacity: false,
        ringOpacity: false,
    },
    theme: {
        extend: {
            colors: {
                tg: {
                    bg: tgColor("--tg-theme-bg-color", "#ffffff"),
                    text: tgColor("--tg-theme-text-color", "#111827"),
                    hint: tgColor("--tg-theme-hint-color", "#6b7280"),
                    link: tgColor("--tg-theme-link-color", "#0284c7"),
                    secondary: tgColor("--tg-theme-secondary-bg-color", "#f3f4f6"),
                    section: tgColor("--tg-theme-section-bg-color", "#ffffff"),
                    separator: tgColor("--tg-theme-section-separator-color", "#e5e7eb"),
                    destructive: tgColor("--tg-theme-destructive-text-color", "#dc2626"),
                    subtitle: tgColor("--tg-theme-subtitle-text-color", "#6b7280"),
                },
                brand: {
                    DEFAULT: "rgb(var(--brand-rgb, 14 165 233) / <alpha-value>)",
                    ink: "rgb(var(--brand-ink-rgb, 255 255 255) / <alpha-value>)",
                },
                success: "rgb(16 185 129 / <alpha-value>)",
                warning: "rgb(245 158 11 / <alpha-value>)",
                danger: "rgb(239 68 68 / <alpha-value>)",
            },
            fontFamily: {
                sans: [
                    "-apple-system",
                    "BlinkMacSystemFont",
                    "Segoe UI",
                    "Roboto",
                    "Helvetica Neue",
                    "sans-serif",
                ],
            },
            fontSize: {
                // Body never below 15px: many customers read on small, bright-sunlit screens.
                sm: ["0.875rem", { lineHeight: "1.25rem" }],
                base: ["0.9375rem", { lineHeight: "1.4rem" }],
                lg: ["1.0625rem", { lineHeight: "1.5rem" }],
                xl: ["1.25rem", { lineHeight: "1.6rem" }],
                "2xl": ["1.5rem", { lineHeight: "1.9rem" }],
            },
            borderRadius: {
                tile: "1.125rem",
                control: "0.875rem",
            },
            zIndex: {
                sticky: "10",
                bar: "20",
                sheet: "30",
                toast: "40",
            },
            transitionTimingFunction: {
                "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
                "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
            },
            keyframes: {
                rise: {
                    from: { opacity: "0", transform: "translateY(8px)" },
                    to: { opacity: "1", transform: "none" },
                },
                pop: {
                    "0%": { transform: "scale(0.86)" },
                    "100%": { transform: "scale(1)" },
                },
                bump: {
                    "0%": { transform: "scale(1)" },
                    "40%": { transform: "scale(1.18)" },
                    "100%": { transform: "scale(1)" },
                },
                shimmer: {
                    from: { backgroundPosition: "150% 0" },
                    to: { backgroundPosition: "-50% 0" },
                },
                ring: {
                    "0%": { transform: "scale(1)", opacity: "0.45" },
                    "100%": { transform: "scale(1.55)", opacity: "0" },
                },
                "sheet-in": {
                    from: { transform: "translateY(100%)" },
                    to: { transform: "none" },
                },
                "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
            },
            animation: {
                rise: "rise 240ms cubic-bezier(0.16, 1, 0.3, 1) both",
                pop: "pop 200ms cubic-bezier(0.16, 1, 0.3, 1) both",
                bump: "bump 260ms cubic-bezier(0.25, 1, 0.5, 1)",
                shimmer: "shimmer 1.4s linear infinite",
                ring: "ring 1.8s cubic-bezier(0.25, 1, 0.5, 1) infinite",
                "sheet-in": "sheet-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both",
                "fade-in": "fade-in 200ms ease-out both",
            },
        },
    },
    plugins: [],
}

export default config

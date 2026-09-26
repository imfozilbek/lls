import type { Config } from "tailwindcss"

const config: Config = {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                tg: {
                    bg: "var(--tg-theme-bg-color, #ffffff)",
                    text: "var(--tg-theme-text-color, #111827)",
                    hint: "var(--tg-theme-hint-color, #6b7280)",
                    link: "var(--tg-theme-link-color, #0284c7)",
                    button: "var(--tg-theme-button-color, #0ea5e9)",
                    "button-text": "var(--tg-theme-button-text-color, #ffffff)",
                    secondary: "var(--tg-theme-secondary-bg-color, #f3f4f6)",
                    section: "var(--tg-theme-section-bg-color, #ffffff)",
                    separator: "var(--tg-theme-section-separator-color, #e5e7eb)",
                    destructive: "var(--tg-theme-destructive-text-color, #ef4444)",
                },
                brand: "rgb(var(--brand-rgb, 14 165 233) / <alpha-value>)",
                success: "#10b981",
                warning: "#f59e0b",
                danger: "#ef4444",
            },
            fontFamily: {
                sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
            },
            transitionTimingFunction: {
                spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
            },
        },
    },
    plugins: [],
}

export default config

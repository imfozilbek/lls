import type { Config } from "tailwindcss"

const config: Config = {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                telegram: {
                    bg: "var(--tg-theme-bg-color)",
                    text: "var(--tg-theme-text-color)",
                    hint: "var(--tg-theme-hint-color)",
                    link: "var(--tg-theme-link-color)",
                    button: "var(--tg-theme-button-color)",
                    buttonText: "var(--tg-theme-button-text-color)",
                    secondary: "var(--tg-theme-secondary-bg-color)",
                },
            },
            animation: {
                "fade-in": "fadeIn 0.2s ease-out",
                "fade-out": "fadeOut 0.2s ease-in",
                "slide-up": "slideUp 0.3s ease-out",
                "slide-down": "slideDown 0.3s ease-in",
                "toast-in": "toastIn 0.3s ease-out",
                "toast-out": "toastOut 0.2s ease-in forwards",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                fadeOut: {
                    "0%": { opacity: "1" },
                    "100%": { opacity: "0" },
                },
                slideUp: {
                    "0%": { transform: "translateY(100%)" },
                    "100%": { transform: "translateY(0)" },
                },
                slideDown: {
                    "0%": { transform: "translateY(0)" },
                    "100%": { transform: "translateY(100%)" },
                },
                toastIn: {
                    "0%": { opacity: "0", transform: "translateY(-12px) scale(0.95)" },
                    "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
                },
                toastOut: {
                    "0%": { opacity: "1", transform: "translateY(0) scale(1)" },
                    "100%": { opacity: "0", transform: "translateY(-12px) scale(0.95)" },
                },
            },
        },
    },
    plugins: [],
}

export default config

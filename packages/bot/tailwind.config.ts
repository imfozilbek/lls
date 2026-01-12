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
                "slide-up": "slideUp 0.3s ease-out",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                slideUp: {
                    "0%": { transform: "translateY(100%)" },
                    "100%": { transform: "translateY(0)" },
                },
            },
        },
    },
    plugins: [],
}

export default config

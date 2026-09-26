import { LANGUAGES } from "@lls/core"

import { useLanguage, useLanguageStore } from "../i18n/index.js"
import { api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"

import type { Language } from "@lls/core"

/** UZ / RU pill. The choice is saved, so bot messages follow it too. */
export function LanguageSwitch(): React.JSX.Element {
    const language = useLanguage()
    const setLanguage = useLanguageStore((state) => state.setLanguage)
    const choose = (next: Language): void => {
        if (next === language) {
            return
        }
        haptic.select()
        setLanguage(next)
        api.setLanguage(next).catch(() => undefined)
    }
    return (
        <div className="flex rounded-full bg-tg-secondary p-0.5 text-xs font-semibold">
            {LANGUAGES.map((code) => (
                <button
                    key={code}
                    type="button"
                    onClick={(): void => choose(code)}
                    aria-pressed={code === language}
                    className={cn(
                        "tap h-10 min-w-11 rounded-full px-2.5 uppercase transition-colors duration-200",
                        code === language ? "bg-tg-bg text-tg-text shadow-sm" : "text-tg-hint",
                    )}
                >
                    {code}
                </button>
            ))}
        </div>
    )
}

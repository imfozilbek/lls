import { useEffect, useRef, useState } from "react"

import { errorText, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { haptic } from "../lib/telegram.js"
import { Spinner } from "../ui/primitives.js"
import { ZumdaMark } from "../ui/zumda-mark.js"

import type { WebSession } from "../lib/api.js"

/** The Zumda | Business bot: its Login Widget signs the owner in on business.zumda.shop. */
export const BUSINESS_BOT: string = import.meta.env.VITE_BUSINESS_BOT ?? "zumdashop_business_bot"
const WIDGET_SRC = "https://telegram.org/js/telegram-widget.js?22"
/** The widget calls this global with the person's signed data. */
const CALLBACK = "__zumdaBusinessLogin"

declare global {
    interface Window {
        [CALLBACK]?: (login: Record<string, string | number>) => void
    }
}

/**
 * business.zumda.shop in a browser: one Telegram button. The widget is Telegram's own (a frame
 * from telegram.org); the Worker checks its signature and gives a 30-day session.
 */
export function WebSignIn({
    onSignedIn,
}: {
    onSignedIn(session: WebSession): void
}): React.JSX.Element {
    const t = useT().web
    const errors = useT()
    const slot = useRef<HTMLDivElement>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const done = useRef(onSignedIn)
    done.current = onSignedIn

    useEffect(() => {
        window[CALLBACK] = (login): void => {
            setBusy(true)
            setError(null)
            api.business
                .signIn(login)
                .then((session) => {
                    haptic.success()
                    done.current(session)
                })
                .catch((caught: unknown) => {
                    setError(
                        errorText(errors, caught instanceof ApiError ? caught.code : "generic"),
                    )
                    setBusy(false)
                })
        }
        const script = document.createElement("script")
        script.async = true
        script.src = WIDGET_SRC
        script.dataset["telegramLogin"] = BUSINESS_BOT
        script.dataset["size"] = "large"
        script.dataset["radius"] = "14"
        script.dataset["requestAccess"] = "write"
        script.dataset["onauth"] = `${CALLBACK}(user)`
        slot.current?.append(script)
        return (): void => {
            script.remove()
            delete window[CALLBACK]
        }
    }, [errors])

    return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
            <div className="flex animate-rise flex-col items-center text-center">
                <ZumdaMark size={72} />
                <h1 className="mt-6 text-balance text-3xl font-bold">{t.title}</h1>
                <p className="mt-3 max-w-[32ch] text-tg-hint">{t.text}</p>
                <div
                    ref={slot}
                    className="mt-8 grid min-h-12 place-items-center"
                    aria-busy={busy}
                />
                {busy ? <Spinner className="mt-4 text-brand" /> : null}
                {error ? (
                    <p className="mt-4 text-sm font-medium text-tg-destructive" role="alert">
                        {error}
                    </p>
                ) : null}
                <p className="mt-10 text-sm text-tg-hint">{t.hint}</p>
            </div>
        </main>
    )
}

import { useEffect, useRef, useState } from "react"

import { errorText, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { haptic } from "../lib/telegram.js"
import { Button } from "../ui/primitives.js"
import { ZumdaMark } from "../ui/zumda-mark.js"

import type { WebSession } from "../lib/api.js"

/** Telegram Login (OpenID Connect): Telegram's own window confirms who signs in. */
const LOGIN_SRC = "https://oauth.telegram.org/js/telegram-login.js?6"
/** Our nonce lives 10 minutes on the Worker: ask for a new one a little before. */
const NONCE_MAX_AGE_MS = 9 * 60 * 1000

interface LoginResult {
    id_token?: string
    error?: string
}

interface TelegramLogin {
    auth(
        options: { client_id: number; nonce?: string; request_access?: string[]; lang?: string },
        callback: (result: LoginResult) => void,
    ): void
}

function telegramLogin(): TelegramLogin | null {
    const telegram = (window as unknown as { Telegram?: { Login?: TelegramLogin } }).Telegram
    return telegram?.Login ?? null
}

/** Loads Telegram's login library once; resolves when `Telegram.Login` is there. */
function loadLibrary(): Promise<void> {
    if (telegramLogin()) {
        return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement("script")
        script.src = LOGIN_SRC
        script.async = true
        script.onload = (): void => resolve()
        script.onerror = (): void => reject(new Error("telegram-login.js"))
        document.head.append(script)
    })
}

interface LoginSetup {
    clientId: number
    nonce: string
    at: number
}

/**
 * business.zumda.shop in a browser: one Telegram button. Telegram's window confirms the person;
 * the Worker checks Telegram's signed `id_token` and gives a 30-day session.
 */
export function WebSignIn({
    onSignedIn,
}: {
    onSignedIn(session: WebSession): void
}): React.JSX.Element {
    const t = useT()
    const [setup, setSetup] = useState<LoginSetup | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const done = useRef(onSignedIn)
    done.current = onSignedIn

    const prepare = async (): Promise<LoginSetup | null> => {
        try {
            const [login] = await Promise.all([api.business.login(), loadLibrary()])
            const next = { ...login, at: Date.now() }
            setSetup(next)
            return next
        } catch (caught) {
            setError(errorText(t, caught instanceof ApiError ? caught.code : "NETWORK"))
            return null
        }
    }
    useEffect(() => {
        void prepare()
        // Once: the library and a nonce are ready before the button is pressed.
    }, [])

    const finish = async (result: LoginResult): Promise<void> => {
        if (!result.id_token) {
            setBusy(false)
            setError(t.web.cancelled)
            void prepare()
            return
        }
        try {
            const session = await api.business.signIn(result.id_token)
            haptic.success()
            done.current(session)
        } catch (caught) {
            setBusy(false)
            setError(errorText(t, caught instanceof ApiError ? caught.code : "generic"))
            void prepare()
        }
    }

    const signIn = (): void => {
        const login = telegramLogin()
        // The window must open in this very tap, or the browser blocks it: setup is ready.
        if (!login || !setup || Date.now() - setup.at > NONCE_MAX_AGE_MS) {
            // A failed start or an old nonce: this tap prepares again (the spinner shows).
            setSetup(null)
            setError(null)
            void prepare()
            return
        }
        haptic.tap()
        setBusy(true)
        setError(null)
        login.auth(
            {
                client_id: setup.clientId,
                nonce: setup.nonce,
                request_access: ["write"],
                lang: "uz",
            },
            (result) => void finish(result),
        )
    }

    return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
            <div className="flex animate-rise flex-col items-center text-center">
                <ZumdaMark size={72} />
                <h1 className="mt-6 text-balance text-3xl font-bold">{t.web.title}</h1>
                <p className="mt-3 max-w-[32ch] text-tg-hint">{t.web.text}</p>
                <Button
                    size="lg"
                    className="mt-8 w-full max-w-xs"
                    // After a failed start the button stays pressable: a tap tries again.
                    loading={busy || (setup === null && error === null)}
                    disabled={setup === null && error === null}
                    onClick={signIn}
                    icon={<TelegramIcon />}
                >
                    {t.web.signIn}
                </Button>
                {error ? (
                    <p className="mt-4 text-sm font-medium text-tg-destructive" role="alert">
                        {error}
                    </p>
                ) : null}
                <p className="mt-10 text-sm text-tg-hint">{t.web.hint}</p>
            </div>
        </main>
    )
}

/** Telegram's paper plane, drawn in the button's own ink. */
function TelegramIcon(): React.JSX.Element {
    return (
        <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M21.5 4.3 18.4 19c-.2 1-.9 1.3-1.8.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.7-7.9c.4-.3-.1-.5-.6-.2L6.3 12.9 1.7 11.4c-1-.3-1-1 .2-1.5l18-6.9c.8-.3 1.6.2 1.6 1.3Z" />
        </svg>
    )
}

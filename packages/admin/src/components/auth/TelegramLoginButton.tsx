import { useEffect, useRef, useCallback } from "react"

import type { ReactNode } from "react"

export interface TelegramLoginData {
    id: number
    first_name: string
    last_name?: string
    username?: string
    photo_url?: string
    auth_date: number
    hash: string
}

interface TelegramLoginButtonProps {
    botName: string
    onAuth: (user: TelegramLoginData) => void
    buttonSize?: "large" | "medium" | "small"
    cornerRadius?: number
    requestAccess?: "write"
}

declare global {
    interface Window {
        TelegramLoginWidget?: {
            dataOnauth: (user: TelegramLoginData) => void
        }
    }
}

export function TelegramLoginButton({
    botName,
    onAuth,
    buttonSize = "large",
    cornerRadius = 8,
    requestAccess,
}: TelegramLoginButtonProps): ReactNode {
    const containerRef = useRef<HTMLDivElement>(null)
    const scriptRef = useRef<HTMLScriptElement | null>(null)

    const handleAuth = useCallback(
        (user: TelegramLoginData): void => {
            onAuth(user)
        },
        [onAuth],
    )

    useEffect(() => {
        window.TelegramLoginWidget = {
            dataOnauth: handleAuth,
        }

        const script = document.createElement("script")
        script.src = "https://telegram.org/js/telegram-widget.js?22"
        script.setAttribute("data-telegram-login", botName)
        script.setAttribute("data-size", buttonSize)
        script.setAttribute("data-radius", String(cornerRadius))
        script.setAttribute("data-onauth", "TelegramLoginWidget.dataOnauth(user)")
        if (requestAccess) {
            script.setAttribute("data-request-access", requestAccess)
        }
        script.async = true

        containerRef.current?.appendChild(script)
        scriptRef.current = script

        return (): void => {
            if (scriptRef.current && containerRef.current?.contains(scriptRef.current)) {
                containerRef.current.removeChild(scriptRef.current)
            }
            delete window.TelegramLoginWidget
        }
    }, [botName, buttonSize, cornerRadius, requestAccess, handleAuth])

    return <div ref={containerRef} className="flex justify-center" />
}

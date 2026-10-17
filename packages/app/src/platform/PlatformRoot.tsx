import { useEffect, useState } from "react"

import { WebSignIn } from "../business/WebSignIn.js"
import { clearSession, loadSession, saveSession } from "../business/web-session.js"
import { errorText, useT } from "../i18n/index.js"
import { ApiError, adminApi, onWebSessionExpired, setAdminBot, setWebSession } from "../lib/api.js"
import { ZUMDA_BRAND_COLOR, ZUMDA_NAME, applyBrand } from "../lib/brand.js"
import { webApp } from "../lib/telegram.js"
import { ScreenSkeleton } from "../ui/boundary.js"
import { ShieldIcon, WifiOffIcon } from "../ui/icons.js"
import { Button, EmptyState } from "../ui/primitives.js"
import { WebBackBar } from "../ui/shell.js"

import { PlatformApp } from "./PlatformApp.js"

import type { WebSession } from "../lib/api.js"
import type { AdminTarget } from "../lib/telegram.js"

type Door =
    { kind: "checking" } | { kind: "open" } | { kind: "closed" } | { kind: "error"; code: string }

/**
 * «Platforma»'s door: one question on opening (`/api/admin/me`), so someone who is not a platform
 * admin sees one clear screen instead of an error in every tab.
 */
function PlatformDoor({
    target,
    onSignOut,
}: {
    target: AdminTarget | null
    onSignOut?: () => void
}): React.JSX.Element {
    const t = useT()
    const [door, setDoor] = useState<Door>({ kind: "checking" })
    const check = async (): Promise<void> => {
        try {
            await adminApi.me()
            setDoor({ kind: "open" })
        } catch (caught) {
            const code = caught instanceof ApiError ? caught.code : "NETWORK"
            setDoor(code === "ADMIN_ONLY" ? { kind: "closed" } : { kind: "error", code })
        }
    }
    useEffect(() => {
        void check()
    }, [])

    if (door.kind === "checking") {
        return <ScreenSkeleton />
    }
    if (door.kind === "closed") {
        return (
            <main className="px-4 pt-4">
                <EmptyState
                    art={<ShieldIcon size={44} />}
                    title={t.platform.notAdminTitle}
                    text={t.platform.notAdminText}
                />
            </main>
        )
    }
    if (door.kind === "error") {
        return (
            <main className="px-4 pt-4">
                <EmptyState
                    art={<WifiOffIcon size={44} />}
                    title={errorText(t, door.code)}
                    action={
                        <Button
                            variant="secondary"
                            onClick={(): void => {
                                setDoor({ kind: "checking" })
                                void check()
                            }}
                        >
                            {t.common.retry}
                        </Button>
                    }
                />
            </main>
        )
    }
    return <PlatformApp target={target} onSignOut={onSignOut} />
}

/** platform.zumda.shop in a browser: Telegram Login of Zumda | Platforma, then «Platforma». */
function PlatformInBrowser({ target }: { target: AdminTarget | null }): React.JSX.Element {
    const p = useT().platform
    const [session, setSession] = useState<WebSession | null>(() => loadSession("admin"))
    setWebSession(session?.token ?? null)
    const signOut = (): void => {
        clearSession("admin")
        setWebSession(null)
        setSession(null)
    }
    useEffect(() => {
        onWebSessionExpired(signOut)
        return (): void => onWebSessionExpired(null)
    }, [])
    if (!session) {
        return (
            <WebSignIn
                bot="admin"
                copy={{ title: p.webTitle, text: p.webText }}
                onSignedIn={(next): void => {
                    saveSession(next, "admin")
                    setSession(next)
                }}
            />
        )
    }
    return (
        <>
            <WebBackBar />
            <PlatformDoor target={target} onSignOut={signOut} />
        </>
    )
}

/**
 * «Platforma» as its own app (owner's decision, October 2026): the first screen of Zumda |
 * Platforma (`?mode=admin`), or platform.zumda.shop in a browser. Its own chunk: owners and
 * customers never load it.
 */
export function PlatformRoot({ target }: { target: AdminTarget | null }): React.JSX.Element {
    // Before any child asks the Worker: every request is signed by Zumda | Platforma.
    useState(() => {
        setAdminBot()
        return null
    })
    useEffect(() => {
        applyBrand(ZUMDA_BRAND_COLOR)
        document.title = `${ZUMDA_NAME} | Platforma`
    }, [])
    return webApp() ? <PlatformDoor target={target} /> : <PlatformInBrowser target={target} />
}

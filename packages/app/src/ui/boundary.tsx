import { Component } from "react"

import { useT } from "../i18n/index.js"

import { WifiOffIcon } from "./icons.js"
import { Button, EmptyState, Skeleton, Spinner } from "./primitives.js"

import type { ReactNode } from "react"

/**
 * A part that may fail to draw: a piece of the app that did not load on a weak network, or whose
 * file is gone after a deploy while the app stayed open. `fallback` stands in for it instead of
 * a white screen. The error still reaches the admins (`reportError` → `listenForCrashes`).
 */
export class Boundary extends Component<
    { children: ReactNode; fallback: ReactNode },
    { failed: boolean }
> {
    override state = { failed: false }

    static getDerivedStateFromError(): { failed: boolean } {
        return { failed: true }
    }

    override componentDidCatch(error: unknown): void {
        if (typeof globalThis.reportError === "function") {
            globalThis.reportError(error)
        }
    }

    override render(): ReactNode {
        return this.state.failed ? this.props.fallback : this.props.children
    }
}

/**
 * The whole app could not go on: one tap loads it again. The cart and the checkout draft live in
 * the phone's storage, so nothing typed is lost.
 */
export function CrashScreen(): React.JSX.Element {
    const t = useT()
    return (
        <main className="px-4 pt-16">
            <EmptyState
                art={<WifiOffIcon size={44} />}
                title={t.common.crashTitle}
                text={t.common.crashText}
                action={
                    <Button variant="secondary" onClick={(): void => window.location.reload()}>
                        {t.common.retry}
                    </Button>
                }
            />
        </main>
    )
}

/** A screen whose piece is still loading: its shape at once, never a blank page. */
export function ScreenSkeleton(): React.JSX.Element {
    return (
        <main className="flex flex-col gap-4 px-4 pt-4" aria-busy="true">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-24 rounded-tile" />
            <Skeleton className="h-16 rounded-tile" />
            <Skeleton className="h-16 rounded-tile" />
        </main>
    )
}

/** A sheet whose piece is still loading: the panel comes up at once with a spinner. */
export function SheetLoading(): React.JSX.Element {
    return (
        <div
            className="fixed inset-x-0 bottom-0 z-sheet flex h-40 items-center justify-center rounded-t-tile bg-tg-bg text-tg-hint shadow-lg"
            aria-busy="true"
        >
            <Spinner className="h-6 w-6" />
        </div>
    )
}

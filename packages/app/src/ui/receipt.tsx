import { receiptExpired } from "@zumda/core"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { useBackButton } from "../lib/main-button.js"
import { haptic } from "../lib/telegram.js"

import { CloseIcon, ReceiptIcon } from "./icons.js"
import { Skeleton } from "./primitives.js"

type Loaded =
    | { state: "loading" }
    | { state: "ready"; url: string }
    | { state: "failed" }
    /** Kept 30 days, then deleted by the storage: nothing to load, nothing went wrong. */
    | { state: "expired" }

/**
 * The transfer screenshot of an order. It is private (never on a public address): the app reads
 * it with its own headers and shows it through an object URL, freed when the screen goes away.
 */
export function useReceiptUrl(orderId: string, sentAt: string | undefined): Loaded {
    const [loaded, setLoaded] = useState<Loaded>({ state: "loading" })
    useEffect(() => {
        if (!sentAt) {
            return undefined
        }
        if (receiptExpired(new Date(sentAt), new Date())) {
            setLoaded({ state: "expired" })
            return undefined
        }
        let alive = true
        let url: string | null = null
        setLoaded({ state: "loading" })
        api.orderReceipt(orderId)
            .then((blob) => {
                if (alive) {
                    url = URL.createObjectURL(blob)
                    setLoaded({ state: "ready", url })
                }
            })
            .catch((error: unknown) => {
                if (alive) {
                    const gone = error instanceof ApiError && error.code === "RECEIPT_EXPIRED"
                    setLoaded({ state: gone ? "expired" : "failed" })
                }
            })
        return (): void => {
            alive = false
            if (url) {
                URL.revokeObjectURL(url)
            }
        }
        // A new screenshot (another `sentAt`) loads again.
    }, [orderId, sentAt])
    return loaded
}

/**
 * The screenshot full screen: the owner reads the sum and the card digits, the customer looks at
 * what they sent. Back (and the swipe) closes the picture first, never the screen under it.
 */
function ReceiptViewer({ url, onClose }: { url: string; onClose(): void }): React.JSX.Element {
    const t = useT()
    useBackButton(onClose)
    useEffect(() => {
        const onKey = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                onClose()
            }
        }
        window.addEventListener("keydown", onKey)
        return (): void => window.removeEventListener("keydown", onKey)
    }, [onClose])
    return createPortal(
        <div
            className="fixed inset-0 z-viewer flex animate-fade-in flex-col bg-black/90"
            role="dialog"
            aria-modal
            aria-label={t.receipt.title}
        >
            <div className="flex justify-end p-3">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t.receipt.close}
                    className="tap grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white"
                >
                    <CloseIcon size={22} />
                </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-3 pb-6">
                <img
                    src={url}
                    alt={t.receipt.title}
                    // A screenshot is a tall phone screen: its room is kept while it loads.
                    className="mx-auto aspect-[9/19] w-full max-w-md bg-tg-secondary object-contain"
                />
            </div>
        </div>,
        document.body,
    )
}

/** A small picture of the screenshot; a tap opens it full screen. */
export function ReceiptThumb({
    orderId,
    sentAt,
    large = false,
}: {
    orderId: string
    sentAt: string | undefined
    /** The owner's money check: big enough to read the sum without opening it. */
    large?: boolean
}): React.JSX.Element | null {
    const t = useT()
    const loaded = useReceiptUrl(orderId, sentAt)
    const [open, setOpen] = useState(false)
    if (!sentAt) {
        return null
    }
    if (loaded.state === "loading") {
        return <Skeleton className="h-24 w-20 shrink-0 rounded-control" />
    }
    if (loaded.state === "failed" || loaded.state === "expired") {
        return (
            <span className="flex h-24 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-control bg-tg-secondary px-1 text-center text-xs text-tg-subtitle">
                <ReceiptIcon size={20} />
                {loaded.state === "expired" ? t.receipt.expired : t.receipt.loadFailed}
            </span>
        )
    }
    return (
        <>
            <button
                type="button"
                onClick={(): void => {
                    haptic.tap()
                    setOpen(true)
                }}
                aria-label={t.receipt.open}
                className={cn("tap flex shrink-0 flex-col items-center gap-1", large && "w-full")}
            >
                {/* Whole, never cropped: the sum and the card digits may sit anywhere on it. */}
                <span
                    className={cn(
                        "block overflow-hidden rounded-control bg-white ring-1 ring-black/10",
                        large ? "h-[30vh] max-h-72 w-full" : "h-24 w-20",
                    )}
                >
                    <img src={loaded.url} alt="" className="h-full w-full object-contain" />
                </span>
                <span className="whitespace-nowrap text-xs font-semibold text-brand">
                    {t.receipt.zoom}
                </span>
            </button>
            {open ? <ReceiptViewer url={loaded.url} onClose={(): void => setOpen(false)} /> : null}
        </>
    )
}

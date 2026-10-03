import { useEffect, useId, useState } from "react"

import { errorText, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { compressReceipt } from "../lib/image.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { ReceiptIcon } from "../ui/icons.js"
import { Button, Spinner } from "../ui/primitives.js"
import { Sheet } from "../ui/sheet.js"

import type { OrderDTO } from "@zumda/core"

interface Picked {
    blob: Blob
    url: string
}

const FOCUS_RING =
    "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand"

/** The big dashed tile to pick the screenshot, then its preview with «Boshqa rasm». */
function ReceiptPicker({
    picked,
    onPicked,
}: {
    picked: Picked | null
    onPicked(picked: Picked): void
}): React.JSX.Element {
    const t = useT()
    const inputId = useId()
    const [reading, setReading] = useState(false)

    const pick = async (file: File | undefined): Promise<void> => {
        if (!file) {
            return
        }
        setReading(true)
        try {
            const blob = await compressReceipt(file)
            onPicked({ blob, url: URL.createObjectURL(blob) })
            haptic.select()
        } catch {
            haptic.error()
            toast(t.receipt.unreadable, "error")
        } finally {
            setReading(false)
        }
    }

    // Right before its label: the label shows the keyboard focus of the hidden input.
    const input = (
        <input
            id={inputId}
            type="file"
            accept="image/*"
            className="peer sr-only"
            onChange={(event): void => {
                void pick(event.target.files?.[0])
                // The same file picked again still fires a change.
                event.target.value = ""
            }}
        />
    )
    if (picked) {
        return (
            <div className="flex animate-fade-in flex-col items-center gap-2">
                <img
                    src={picked.url}
                    alt={t.receipt.title}
                    className="max-h-[36vh] w-auto rounded-control bg-tg-secondary object-contain ring-1 ring-black/5"
                />
                {input}
                <label
                    htmlFor={inputId}
                    className={`tap inline-flex min-h-11 cursor-pointer items-center rounded-control px-4 font-semibold text-brand ${FOCUS_RING}`}
                >
                    {t.receipt.change}
                </label>
            </div>
        )
    }
    return (
        <div className="flex flex-col">
            {input}
            <label
                htmlFor={inputId}
                className={`tap flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-tile border-2 border-dashed border-brand/40 bg-brand/5 font-semibold text-tg-text ${FOCUS_RING}`}
            >
                {reading ? (
                    <Spinner className="h-6 w-6 text-brand" />
                ) : (
                    <ReceiptIcon size={32} className="text-brand" />
                )}
                {t.receipt.pick}
            </label>
        </div>
    )
}

/**
 * «O'tkazdim» with the proof: the customer picks the bank app's screenshot, sees it, and sends it.
 * The owner gets it in the chat next to the sum and checks the card, not the picture.
 */
export function ReceiptSheet({
    order,
    onSent,
    onClose,
}: {
    order: OrderDTO
    onSent(order: OrderDTO): void
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    const [picked, setPicked] = useState<Picked | null>(null)
    const [sending, setSending] = useState(false)

    // The preview's object URL lives exactly as long as the preview.
    useEffect(() => {
        if (!picked) {
            return undefined
        }
        const { url } = picked
        return (): void => URL.revokeObjectURL(url)
    }, [picked])

    const send = async (): Promise<void> => {
        if (!picked) {
            return
        }
        setSending(true)
        try {
            onSent(await api.transferSent(order.id, picked.blob))
            haptic.success()
            toast(t.receipt.sent, "success")
            onClose()
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setSending(false)
        }
    }

    return (
        <Sheet title={t.receipt.title} onClose={onClose}>
            <p className="text-sm text-tg-subtitle">{t.receipt.hint}</p>
            <p className="text-sm text-tg-subtitle">{t.receipt.howTo}</p>
            <ReceiptPicker picked={picked} onPicked={setPicked} />
            <Button
                size="lg"
                className="mt-1"
                disabled={!picked}
                loading={sending}
                onClick={(): void => void send()}
            >
                {t.receipt.send}
            </Button>
        </Sheet>
    )
}

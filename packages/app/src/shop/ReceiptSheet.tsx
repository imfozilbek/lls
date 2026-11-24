import { useEffect, useRef, useState } from "react"

import { errorText, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { compressReceipt } from "../lib/image.js"
import { useClosingGuard } from "../lib/main-button.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { ReceiptIcon } from "../ui/icons.js"
import { Button, Spinner } from "../ui/primitives.js"
import { receiptWords } from "../ui/receipt-words.js"
import { Sheet } from "../ui/sheet.js"

import type { OrderDTO } from "@zumda/core"

interface Picked {
    blob: Blob
    url: string
}

const PRESSED =
    "tap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"

/**
 * The big dashed tile to pick the screenshot, then its preview with «Boshqa rasm».
 * A button clicks the hidden file field, as the product photo and the logo do: in Telegram for
 * Android 17 a label tied to the field did not open the gallery (November 2026), a button does.
 */
function ReceiptPicker({
    picked,
    onPicked,
}: {
    picked: Picked | null
    onPicked(picked: Picked): void
}): React.JSX.Element {
    const receipt = receiptWords(useLanguage())
    const input = useRef<HTMLInputElement>(null)
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
            toast(receipt.unreadable, "error")
        } finally {
            setReading(false)
        }
    }
    const open = (): void => {
        haptic.tap()
        input.current?.click()
    }

    const field = (
        <input
            ref={input}
            type="file"
            accept="image/*"
            className="hidden"
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
                    alt={receipt.title}
                    className="h-[36vh] w-auto max-w-full rounded-control bg-tg-secondary object-contain pic-frame"
                />
                {field}
                <button
                    type="button"
                    onClick={open}
                    className={`inline-flex min-h-11 items-center rounded-control px-4 font-semibold text-brand ${PRESSED}`}
                >
                    {receipt.change}
                </button>
            </div>
        )
    }
    return (
        <div className="flex flex-col">
            {field}
            <button
                type="button"
                onClick={open}
                disabled={reading}
                className={`flex h-40 flex-col items-center justify-center gap-2 rounded-tile border-2 border-dashed border-brand/40 bg-brand/5 font-semibold text-tg-text ${PRESSED}`}
            >
                {reading ? (
                    <Spinner className="h-6 w-6 text-brand" />
                ) : (
                    <ReceiptIcon size={32} className="text-brand" />
                )}
                {receipt.pick}
            </button>
        </div>
    )
}

/**
 * «Chekni yuklash», then «O'tkazdim» (owner's decision, November 2026): the customer picks the
 * bank app's screenshot and sees it; only then does «O'tkazdim» open and send it. The owner gets it
 * in the chat next to the sum and checks the card, not the picture.
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
    const receipt = receiptWords(useLanguage())
    const [picked, setPicked] = useState<Picked | null>(null)
    // A screenshot picked but not sent yet: closing the app by mistake asks first.
    useClosingGuard(picked !== null)
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
            toast(receipt.sent, "success")
            onClose()
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setSending(false)
        }
    }

    return (
        <Sheet
            title={receipt.title}
            onClose={onClose}
            footer={
                <Button
                    size="lg"
                    disabled={!picked}
                    loading={sending}
                    onClick={(): void => void send()}
                >
                    {receipt.confirm}
                </Button>
            }
        >
            <p className="text-sm text-tg-subtitle">{receipt.hint}</p>
            {/* How to take one, until there is one. */}
            {picked ? null : <p className="text-sm text-tg-subtitle">{receipt.howTo}</p>}
            <ReceiptPicker picked={picked} onPicked={setPicked} />
        </Sheet>
    )
}

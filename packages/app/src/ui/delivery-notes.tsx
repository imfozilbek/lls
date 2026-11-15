import { useLanguage } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { formatTime } from "../lib/format.js"

import { BoxIcon } from "./icons.js"

import type { OrderDTO } from "@zumda/core"

/**
 * How the dispatcher sent the order and their notes, newest first like a parcel's tracking
 * (owner's decision, November 2026: the customer sees every note). Only lazy screens use it: the
 * owner's orders, the courier screen, the customer's order.
 */
export function DeliveryNotes({
    order,
    sent,
    className,
}: {
    order: OrderDTO
    /** «Pochta orqali jo'natildi», in the reader's words; nothing before «Jo'natdim». */
    sent?: string
    className?: string
}): React.JSX.Element | null {
    const language = useLanguage()
    const notes = [...order.deliveryNotes].reverse()
    if (!sent && notes.length === 0) {
        return null
    }
    return (
        <div
            className={cn("flex flex-col gap-2 rounded-control bg-tg-bg p-3", className)}
            data-delivery-notes
        >
            {sent ? (
                <p className="flex items-center gap-2 font-semibold">
                    <BoxIcon size={18} className="shrink-0 text-brand" />
                    {sent}
                </p>
            ) : null}
            {notes.length > 0 ? (
                <ol className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                    {notes.map((note, index) => (
                        <li key={`${note.at}-${index}`} className="contents">
                            <span className="pt-px text-sm tabular-nums text-tg-hint">
                                {formatTime(note.at, language)}
                            </span>
                            <span
                                className={cn(
                                    "min-w-0 whitespace-pre-line break-words",
                                    index > 0 && "text-tg-subtitle",
                                )}
                            >
                                {note.text}
                            </span>
                        </li>
                    ))}
                </ol>
            ) : null}
        </div>
    )
}

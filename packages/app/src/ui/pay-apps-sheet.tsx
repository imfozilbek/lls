import { useLanguage, useT } from "../i18n/index.js"
import { formatMoney } from "../lib/format.js"
import { PAY_APPS } from "../lib/pay-apps.js"
import { haptic, openOutside } from "../lib/telegram.js"

import { Sheet } from "./sheet.js"

/** "1234567812345678" → "1234 5678 1234 5678". */
export function groupCard(number: string): string {
    return number.replace(/(\d{4})(?=\d)/g, "$1 ")
}

const TILE_FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"

/**
 * After «Raqamni nusxalash» (owner's decision, November 2026): the sum to type, shown and not
 * copied, then the bank apps; a tap opens one and the number is already in the clipboard. When
 * the phone gave no clipboard, the number stands in the sheet to copy by hand.
 */
export function PayAppsSheet({
    card,
    total,
    copied,
    onClose,
}: {
    card: string
    total: number
    /** The number is in the clipboard; otherwise the sheet shows it. */
    copied: boolean
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const a = t.pay.apps
    return (
        <Sheet title={copied ? t.pay.copied : t.pay.cardNumber} onClose={onClose}>
            {copied ? null : (
                <p className="select-all text-xl font-bold tracking-wide tabular-nums">
                    {groupCard(card)}
                </p>
            )}
            <div className="rounded-control bg-tg-secondary px-4 py-3">
                <p className="text-sm text-tg-hint">{a.sum}</p>
                <p className="text-2xl font-bold tabular-nums">{formatMoney(total, language)}</p>
            </div>
            <p className="text-pretty px-1 text-sm text-tg-subtitle">{a.how}</p>
            <ul className="grid grid-cols-2 gap-2">
                {PAY_APPS.map((app, index) => (
                    <li
                        key={app.id}
                        className="animate-rise"
                        style={{ animationDelay: `${index * 40}ms` }}
                    >
                        <button
                            type="button"
                            onClick={(): void => {
                                haptic.tap()
                                openOutside(app.url)
                                onClose()
                            }}
                            className={`tap flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded-control bg-tg-secondary px-2 py-3 font-semibold ${TILE_FOCUS}`}
                        >
                            <img
                                src={app.icon}
                                alt=""
                                width={48}
                                height={48}
                                decoding="async"
                                className="pic-frame h-12 w-12 rounded-[0.75rem] shadow-card"
                            />
                            <span>{app.name}</span>
                        </button>
                    </li>
                ))}
            </ul>
            <p className="text-balance px-1 pt-1 text-center text-sm text-tg-hint">{a.other}</p>
        </Sheet>
    )
}

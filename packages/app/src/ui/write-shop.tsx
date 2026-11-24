import { useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { haptic, openTelegramLink } from "../lib/telegram.js"
import { useSession } from "../stores/session.js"

import { ChatIcon } from "./icons.js"

/**
 * «Savolim bor» and what it needs, in its own module: only the order screen and the
 * product's sheet (lazy chunks) draw it, so none of it is in a customer's first download.
 */

/** What «Savolim bor» was pressed on: the customer's order, or a product. */
export type SupportAbout = { orderId: string } | { productId: string }

/**
 * The shop's bot opened on `/start q_o<order>` or `q_p<product>`: the shop's people see in the
 * customer's topic what the question is about (goal 21).
 */
export function supportStartLink(botUsername: string, about: SupportAbout): string {
    const payload = "orderId" in about ? `q_o${about.orderId}` : `q_p${about.productId}`
    return `https://t.me/${botUsername}?start=${payload}`
}

/**
 * «Savolim bor» (goals 21, 23): only for a shop that answers from its support group. Opens
 * the shop's bot on what it is about; the customer writes there, the answer comes there.
 */
export function WriteShopLink({
    about,
    className,
}: {
    about: SupportAbout
    /** The background: `bg-tg-secondary` on the page, `bg-tg-bg` inside a card. */
    className?: string
}): React.JSX.Element | null {
    const t = useT()
    const shop = useSession((state) => state.shop)
    if (!shop?.supportChat) {
        return null
    }
    return (
        <button
            type="button"
            onClick={(): void => {
                haptic.tap()
                openTelegramLink(supportStartLink(shop.botUsername, about))
            }}
            className={cn(
                "tap flex min-h-12 items-center justify-center gap-2 rounded-control px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
                className ?? "bg-tg-secondary",
            )}
        >
            <ChatIcon size={18} className="text-brand" />
            {t.order.writeShop}
        </button>
    )
}

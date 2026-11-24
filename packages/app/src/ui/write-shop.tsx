import { useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { haptic, openTelegramLink } from "../lib/telegram.js"
import { useSession } from "../stores/session.js"

import { Icon } from "./icons.js"

import type { IconProps } from "./icons.js"

/**
 * «Do'konga xabar yozish» and what it needs, in its own module: only the order screen and the
 * product's sheet (lazy chunks) draw it, so none of it is in a customer's first download.
 */

/** What «Do'konga xabar yozish» was pressed on: the customer's order, or a product. */
export type SupportAbout = { orderId: string } | { productId: string }

/**
 * The shop's bot opened on `/start q_o<order>` or `q_p<product>`: the shop's people see in the
 * customer's topic what the question is about (goal 21).
 */
export function supportStartLink(botUsername: string, about: SupportAbout): string {
    const payload = "orderId" in about ? `q_o${about.orderId}` : `q_p${about.productId}`
    return `https://t.me/${botUsername}?start=${payload}`
}

/** A speech bubble: «Do'konga xabar yozish». */
export const ChatIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-7.5L7 20.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />
        <path d="M8 10h8M8 13h5" />
    </Icon>
)
/**
 * «Do'konga xabar yozish» (goal 21): only for a shop that answers from its support group. Opens
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

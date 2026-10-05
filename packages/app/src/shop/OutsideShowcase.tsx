import { useEffect, useState } from "react"

import { useT } from "../i18n/index.js"
import { api, setShop } from "../lib/api.js"
import { haptic, openTelegramLink } from "../lib/telegram.js"
import { BotIcon, StoreIcon } from "../ui/icons.js"
import { Button, EmptyState, Skeleton } from "../ui/primitives.js"

/**
 * A Zumda Shop QR of a shop that is not in the showcase (any more): the person is sent to the
 * shop's own bot (owner's decision, goal 16), or back to the other shops.
 */
export function OutsideShowcase({
    slug,
    onExit,
}: {
    slug: string
    onExit?: () => void
}): React.JSX.Element {
    const t = useT()
    // undefined: still asking; null: no such active shop.
    const [bot, setBot] = useState<string | null | undefined>(undefined)
    useEffect(() => {
        let alive = true
        // Asked as Zumda Shop itself: the shop's headers would be refused for this slug.
        setShop(null)
        api.showcase
            .shopBot(slug)
            .then((found) => {
                if (alive) {
                    setBot(found.botUsername)
                }
            })
            .catch(() => {
                if (alive) {
                    setBot(null)
                }
            })
        return (): void => {
            alive = false
        }
    }, [slug])
    if (bot === undefined) {
        return <Skeleton className="mx-4 mt-6 h-40 rounded-tile" />
    }
    return (
        <EmptyState
            art={<StoreIcon size={44} />}
            title={bot ? t.shop.outsideShowcaseTitle : t.shop.notFoundTitle}
            text={bot ? t.shop.outsideShowcaseText : t.shop.notFoundText}
            action={
                <div className="flex flex-col items-center gap-2">
                    {bot ? (
                        <Button
                            icon={<BotIcon size={18} />}
                            onClick={(): void => {
                                haptic.tap()
                                openTelegramLink(`https://t.me/${bot}`)
                            }}
                        >
                            {t.shop.openShopBot}
                        </Button>
                    ) : null}
                    {onExit ? (
                        <Button variant="secondary" onClick={onExit}>
                            {t.shop.otherShops}
                        </Button>
                    ) : null}
                </div>
            }
        />
    )
}

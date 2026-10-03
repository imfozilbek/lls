import { Language } from "@lls/core"
import { useState } from "react"

import { dictionaryFor, errorText, useT } from "../i18n/index.js"
import { ApiError, api, imageUrl } from "../lib/api.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { QrIcon } from "../ui/icons.js"
import { Button } from "../ui/primitives.js"

import type { ShopOwnerDTO } from "@lls/core"

/** A poster with the shop's QR for the counter, the door or Instagram. The bot sends it as a file. */
export function PosterSection({ shop }: { shop: ShopOwnerDTO }): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    const [busy, setBusy] = useState(false)
    const send = async (): Promise<void> => {
        setBusy(true)
        try {
            // Loaded on tap: the QR code library stays out of every other screen.
            const { drawPoster } = await import("../lib/poster.js")
            const png = await drawPoster({
                shopName: shop.name,
                botUsername: shop.botUsername,
                brandColor: shop.brandColor,
                logoUrl: imageUrl(shop.logoKey) ?? null,
                line: dictionaryFor(Language.UZ, shop.type).owner.settings.posterLine,
            })
            await api.owner.sendPoster(png)
            haptic.success()
            toast(s.posterSent, "success")
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setBusy(false)
        }
    }
    return (
        <section className="flex items-start gap-4 rounded-tile bg-tg-secondary p-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-control bg-brand/15 text-brand">
                <QrIcon size={26} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div>
                    <h2 className="font-semibold">{s.poster}</h2>
                    <p className="text-sm text-tg-hint">{s.posterHint}</p>
                </div>
                <Button
                    variant="surface"
                    loading={busy}
                    className="self-start"
                    onClick={(): void => void send()}
                >
                    {s.poster}
                </Button>
            </div>
        </section>
    )
}

import { Language } from "@zumda/core"
import { useEffect, useState } from "react"

import { dictionaryFor, errorText, useT } from "../i18n/index.js"
import { ApiError, api, imageUrl } from "../lib/api.js"
import { downloadFile, haptic, openTelegramLink, shopBotStartLink } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { AlertIcon, BotIcon, CheckIcon, QrIcon } from "../ui/icons.js"
import { Button } from "../ui/primitives.js"
import { Sheet } from "../ui/sheet.js"

import type { OwnerDelivery } from "../lib/api.js"
import type { ShopOwnerDTO } from "@zumda/core"

interface Poster {
    /** The drawn picture, shown at once from memory. */
    preview: string
    /** The same file on the Worker: what «Yuklab olish» saves. */
    url: string
    delivered: OwnerDelivery
}

/** Where the poster went besides the download, and what to do when the bot could not write. */
function Delivered({
    shop,
    delivered,
}: {
    shop: ShopOwnerDTO
    delivered: OwnerDelivery
}): React.JSX.Element {
    const s = useT().owner.settings
    if (delivered === "shop") {
        return (
            <p className="flex items-center gap-2 text-sm text-tg-subtitle">
                <CheckIcon size={16} strokeWidth={2.5} className="shrink-0 text-success" />
                {s.posterSent}
            </p>
        )
    }
    return (
        <div className="flex flex-col gap-2 rounded-control bg-warning/10 p-3">
            <p className="flex gap-2 text-sm">
                <AlertIcon size={18} className="mt-0.5 shrink-0 text-warning" />
                {delivered === "business" ? s.posterSentBusiness : s.posterSentNone}
            </p>
            <Button
                variant="surface"
                className="self-start"
                icon={<BotIcon size={18} />}
                onClick={(): void => {
                    haptic.tap()
                    openTelegramLink(shopBotStartLink(shop.botUsername))
                }}
            >
                {s.openBot}
            </Button>
        </div>
    )
}

function PosterSheet({
    shop,
    poster,
    onClose,
}: {
    shop: ShopOwnerDTO
    poster: Poster
    onClose(): void
}): React.JSX.Element {
    const s = useT().owner.settings
    return (
        <Sheet title={s.posterReady} onClose={onClose}>
            <img
                src={poster.preview}
                alt={s.posterImage}
                className="mx-auto aspect-[4/5] w-full max-w-[16rem] animate-pop rounded-control bg-tg-secondary object-contain shadow-sm"
            />
            <Button
                size="lg"
                onClick={(): void => {
                    haptic.success()
                    downloadFile(poster.url, `${shop.slug}-qr.png`)
                }}
            >
                {s.posterDownload}
            </Button>
            <Delivered shop={shop} delivered={poster.delivered} />
        </Sheet>
    )
}

/**
 * A poster with the shop's QR for the counter, the door or Instagram: shown here to download,
 * and sent as a file to the owner's chat.
 */
export function PosterSection({ shop }: { shop: ShopOwnerDTO }): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    const [busy, setBusy] = useState(false)
    const [poster, setPoster] = useState<Poster | null>(null)
    useEffect(
        () => (): void => {
            if (poster) {
                URL.revokeObjectURL(poster.preview)
            }
        },
        [poster],
    )
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
                poweredBy: dictionaryFor(Language.UZ, shop.type).common.poweredBy,
            })
            const { delivered, key } = await api.owner.sendPoster(png)
            if (delivered === "shop") {
                haptic.success()
            } else {
                haptic.warning()
            }
            setPoster({
                preview: URL.createObjectURL(png),
                url: imageUrl(key) ?? "",
                delivered,
            })
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
            {poster ? (
                <PosterSheet shop={shop} poster={poster} onClose={(): void => setPoster(null)} />
            ) : null}
        </section>
    )
}

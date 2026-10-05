import { BusinessStatus, Language } from "@zumda/core"
import { useEffect, useState } from "react"

import { dictionaryFor, errorText, useT } from "../i18n/index.js"
import { ApiError, api, imageUrl } from "../lib/api.js"
import { downloadFile, haptic, openTelegramLink, shopBotStartLink } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { AlertIcon, BotIcon, CheckIcon, QrIcon } from "../ui/icons.js"
import { Button } from "../ui/primitives.js"
import { Sheet } from "../ui/sheet.js"

import type { OwnerDelivery, PosterKind } from "../lib/api.js"
import type { ShopOwnerDTO } from "@zumda/core"

interface Poster {
    /** The drawn picture, shown at once from memory. */
    preview: string
    /** The same file on the Worker: what «Yuklab olish» saves. */
    url: string
    delivered: OwnerDelivery
    kind: PosterKind
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
                    downloadFile(
                        poster.url,
                        `${shop.slug}-${poster.kind === "zumda" ? "zumda-" : ""}qr.png`,
                    )
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
 * and sent as a file to the owner's chat. Two QRs: the shop's own bot, or Zumda Shop opening on
 * the shop (owner's decision, goal 16: only for a shop in the showcase, an order through it is
 * a showcase order).
 */
export function PosterSection({ shop }: { shop: ShopOwnerDTO }): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    const [busy, setBusy] = useState<PosterKind | null>(null)
    const inShowcase = shop.status === BusinessStatus.ACTIVE && shop.marketplace !== undefined
    const [poster, setPoster] = useState<Poster | null>(null)
    useEffect(
        () => (): void => {
            if (poster) {
                URL.revokeObjectURL(poster.preview)
            }
        },
        [poster],
    )
    const send = async (kind: PosterKind): Promise<void> => {
        setBusy(kind)
        try {
            // Loaded on tap: the QR code library stays out of every other screen.
            const { ZUMDA_SHOP_BOT, drawPoster, shopBotLink, zumdaShopLink } =
                await import("../lib/poster.js")
            const words = dictionaryFor(Language.UZ, shop.type)
            const zumda = kind === "zumda"
            const png = await drawPoster({
                shopName: shop.name,
                link: zumda ? zumdaShopLink(shop.slug) : shopBotLink(shop.botUsername),
                linkLabel: `t.me/${zumda ? ZUMDA_SHOP_BOT : shop.botUsername}`,
                brandColor: shop.brandColor,
                logoUrl: imageUrl(shop.logoKey) ?? null,
                line: zumda
                    ? words.owner.settings.posterZumdaLine
                    : words.owner.settings.posterLine,
                poweredBy: words.common.poweredBy,
            })
            const { delivered, key } = await api.owner.sendPoster(png, kind)
            if (delivered === "shop") {
                haptic.success()
            } else {
                haptic.warning()
            }
            setPoster({
                preview: URL.createObjectURL(png),
                url: imageUrl(key) ?? "",
                delivered,
                kind,
            })
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setBusy(null)
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
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="surface"
                        loading={busy === "shop"}
                        disabled={busy !== null}
                        onClick={(): void => void send("shop")}
                    >
                        {s.posterShop}
                    </Button>
                    <Button
                        variant="surface"
                        loading={busy === "zumda"}
                        disabled={busy !== null || !inShowcase}
                        onClick={(): void => void send("zumda")}
                    >
                        {s.posterZumda}
                    </Button>
                </div>
                <p className="text-sm text-tg-hint">
                    {inShowcase ? s.posterZumdaHint : s.posterZumdaOff}
                </p>
            </div>
            {poster ? (
                <PosterSheet shop={shop} poster={poster} onClose={(): void => setPoster(null)} />
            ) : null}
        </section>
    )
}

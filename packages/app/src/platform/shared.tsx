import { formatPhone, mapUrl } from "@zumda/core"
import { useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError } from "../lib/api.js"
import { callLink, haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { PhoneIcon, PinIcon } from "../ui/icons.js"
import { MapButton } from "../ui/maps.js"
import { ShopLogo } from "../ui/shop-logo.js"

import type { Dictionary } from "../i18n/index.js"
import type { AdminShopResult } from "../lib/api.js"
import type { PlatformShopDTO } from "@zumda/core"

/** The shop's logo, or its first letter on its own color. */
export function ShopBadge({ shop }: { shop: PlatformShopDTO }): React.JSX.Element {
    return (
        <ShopLogo
            name={shop.name}
            logoKey={shop.logoKey}
            color={shop.brandColor}
            className="h-12 w-12 rounded-control text-lg"
        />
    )
}

/** Name, kind and bot: the head of every shop card in «Platforma». */
export function ShopHead({ shop }: { shop: PlatformShopDTO }): React.JSX.Element {
    const t = useT()
    return (
        <div className="flex items-center gap-3">
            <ShopBadge shop={shop} />
            <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold">{shop.name}</p>
                <p className="truncate text-sm text-tg-hint">
                    {t.onboarding.types[shop.type]} · @{shop.botUsername}
                </p>
            </div>
        </div>
    )
}

/** Who owns it: the name Telegram gave us, and a phone to call if they shared it. */
export function OwnerLine({ shop }: { shop: PlatformShopDTO }): React.JSX.Element {
    const t = useT().platform
    const phone = shop.owner.phone
    return (
        <div className="flex items-center justify-between gap-3 rounded-control bg-tg-bg px-3 py-2.5">
            <div className="min-w-0">
                <p className="text-xs font-medium text-tg-subtitle">{t.owner}</p>
                <p className="truncate font-semibold">{shop.owner.name ?? t.ownerUnknown}</p>
            </div>
            {phone ? (
                <a
                    {...callLink(phone)}
                    className="tap flex h-11 shrink-0 items-center gap-2 rounded-control bg-brand/10 px-3 text-sm font-semibold text-tg-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                    <PhoneIcon size={18} className="text-brand" />
                    {formatPhone(phone)}
                </a>
            ) : null}
        </div>
    )
}

/**
 * Where the business is: its address, its place on our map and whether a district covers it. An
 * admin sees it before approving; a wrong address is the usual reason to send it back.
 */
export function PlaceLine({ shop }: { shop: PlatformShopDTO }): React.JSX.Element {
    const t = useT().platform
    return (
        <div className="flex items-center gap-3 rounded-control bg-tg-bg px-3 py-2.5">
            <PinIcon size={18} className="shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
                <p className={shop.address ? "font-medium" : "text-tg-hint"}>
                    {shop.address ?? t.noAddress}
                </p>
                {shop.location && !shop.inDistrict ? (
                    <p className="text-sm text-tg-subtitle">{t.outsideDistricts}</p>
                ) : null}
            </div>
            {shop.location ? (
                <MapButton
                    markers={[
                        {
                            id: shop.id,
                            point: shop.location,
                            kind: "shop",
                            title: shop.name,
                        },
                    ]}
                    href={mapUrl(shop.location)}
                    label={t.onMap}
                    className="tap grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/10 text-brand"
                >
                    <PinIcon size={20} />
                </MapButton>
            ) : null}
        </div>
    )
}

export function failToast(t: Dictionary, caught: unknown): void {
    haptic.error()
    toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
}

/** A bot Telegram refused is not a failed action: the shop is saved, the admin sees why. */
export function botToast(t: Dictionary, result: AdminShopResult, done: string): void {
    if (result.bot && !result.bot.connected) {
        haptic.error()
        toast(fill(t.platform.botNotConnected, { reason: result.bot.reason }), "error")
        return
    }
    haptic.success()
    toast(done, "success")
}

/** One request at a time per card, with its spinner; errors become a toast. */
export function useBusy(): {
    busy: string | null
    run(key: string, task: () => Promise<void>): Promise<void>
} {
    const t = useT()
    const [busy, setBusy] = useState<string | null>(null)
    const run = async (key: string, task: () => Promise<void>): Promise<void> => {
        setBusy(key)
        try {
            await task()
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setBusy(null)
        }
    }
    return { busy, run }
}

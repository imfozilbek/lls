import { useEffect, useState } from "react"

import { errorText, useT } from "../i18n/index.js"
import { ApiError, api, imageUrl } from "../lib/api.js"
import { ZUMDA_BRAND_COLOR, applyBrand, readableInk } from "../lib/brand.js"
import { cn } from "../lib/cn.js"
import { hexToRgbChannels } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { haptic } from "../lib/telegram.js"
import { BotIcon, ChevronIcon, WifiOffIcon } from "../ui/icons.js"
import { Button, EmptyState, PoweredBy, Section, Skeleton } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import { Wizard } from "./Wizard.js"

import type { ShopOwnerDTO } from "@zumda/core"

/** Tapping a shop opens its owner section right here; a turned-off shop opens nowhere. */
function ShopRow({
    shop,
    onOpen,
}: {
    shop: ShopOwnerDTO
    onOpen(slug: string): void
}): React.JSX.Element {
    const t = useT().onboarding
    const logo = imageUrl(shop.logoKey)
    const active = shop.status === "active"
    const opens = shop.status !== "disabled"
    return (
        <li>
            <button
                type="button"
                disabled={!opens}
                onClick={(): void => {
                    haptic.tap()
                    onOpen(shop.slug)
                }}
                className="tap flex w-full items-center gap-3 rounded-tile bg-tg-secondary p-3 text-left disabled:active:scale-100"
            >
                {logo ? (
                    <img src={logo} alt="" className="h-12 w-12 rounded-control object-cover" />
                ) : (
                    <span
                        className="grid h-12 w-12 place-items-center rounded-control text-lg font-bold"
                        style={{
                            backgroundColor: shop.brandColor,
                            color: `rgb(${readableInk(hexToRgbChannels(shop.brandColor) ?? "")})`,
                        }}
                    >
                        {shop.name.trim().charAt(0).toUpperCase()}
                    </span>
                )}
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{shop.name}</span>
                    <span className="block truncate text-sm text-tg-hint">@{shop.botUsername}</span>
                </span>
                <span
                    className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        active ? "bg-success/15" : "bg-warning/15",
                    )}
                >
                    {t.status[shop.status]}
                </span>
                {opens ? <ChevronIcon size={18} className="text-tg-hint" /> : null}
            </button>
        </li>
    )
}

function Intro({ onStart }: { onStart(): void }): React.JSX.Element {
    const t = useT().onboarding
    useMainAction({ text: t.start, onClick: onStart })
    return <EmptyState art={<BotIcon size={44} />} title={t.title} text={t.subtitle} />
}

function Home({
    shops,
    onAdd,
    onOpen,
    onSignOut,
}: {
    shops: ShopOwnerDTO[]
    onAdd(): void
    onOpen(slug: string): void
    onSignOut?: () => void
}): React.JSX.Element {
    const web = useT().web
    const t = useT().onboarding
    useMainAction({ text: t.addShop, onClick: onAdd })
    return (
        <main className="px-4 pt-4">
            <Section title={t.myShops}>
                <ul className="flex flex-col gap-3">
                    {shops.map((shop) => (
                        <ShopRow key={shop.id} shop={shop} onOpen={onOpen} />
                    ))}
                </ul>
            </Section>
            {onSignOut ? (
                <button
                    type="button"
                    onClick={onSignOut}
                    className="tap mx-auto mt-6 block rounded-control px-3 py-2 text-sm font-semibold text-tg-hint"
                >
                    {web.signOut}
                </button>
            ) : null}
            <PoweredBy />
            <BottomSpacer />
        </main>
    )
}

/**
 * The Zumda Business bot's «Mening bizneslarim»: the owner's businesses with their review status, a new
 * one through the wizard, and any of them opened for management (`onOpen`).
 */
export function OnboardingApp({
    onOpen,
    onSignOut,
}: {
    onOpen(slug: string): void
    /** In a browser (business.zumda.shop): sign out of this computer. */
    onSignOut?: () => void
}): React.JSX.Element {
    const t = useT()
    const [shops, setShops] = useState<ShopOwnerDTO[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [wizard, setWizard] = useState(false)

    const load = async (): Promise<void> => {
        setError(null)
        try {
            setShops(await api.platform.myShops())
        } catch (caught) {
            const code = caught instanceof ApiError ? caught.code : "generic"
            // An expired browser session: back to «sign in with Telegram».
            if (code === "UNAUTHORIZED" && onSignOut) {
                onSignOut()
                return
            }
            setError(code)
        }
    }
    useEffect(() => {
        applyBrand(ZUMDA_BRAND_COLOR)
        void load()
    }, [])

    if (wizard) {
        return (
            <Wizard
                onCancel={(): void => setWizard(false)}
                onDone={(): void => {
                    setWizard(false)
                    void load()
                }}
            />
        )
    }
    if (error) {
        return (
            <EmptyState
                art={<WifiOffIcon size={44} />}
                title={errorText(t, error)}
                action={
                    <Button variant="secondary" onClick={(): void => void load()}>
                        {t.common.retry}
                    </Button>
                }
            />
        )
    }
    if (shops === null) {
        return (
            <div className="flex flex-col gap-3 px-4 pt-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-[72px] rounded-tile" />
            </div>
        )
    }
    if (shops.length === 0) {
        return <Intro onStart={(): void => setWizard(true)} />
    }
    return (
        <Home
            shops={shops}
            onAdd={(): void => setWizard(true)}
            onOpen={onOpen}
            onSignOut={onSignOut}
        />
    )
}

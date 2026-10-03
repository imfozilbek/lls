import { useEffect, useState } from "react"

import { errorText, useT } from "../i18n/index.js"
import { ApiError, api, imageUrl } from "../lib/api.js"
import { applyBrand, readableInk } from "../lib/brand.js"
import { cn } from "../lib/cn.js"
import { hexToRgbChannels } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { haptic, openTelegramLink } from "../lib/telegram.js"
import { BotIcon, ChevronIcon, WifiOffIcon } from "../ui/icons.js"
import { Button, EmptyState, PoweredBy, Section, Skeleton } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import { Wizard } from "./Wizard.js"

import type { ShopOwnerDTO } from "@zumda/core"

/** LLS's own color: onboarding happens in the platform bot, not in a shop. */
const PLATFORM_COLOR = "#0ea5e9"

function ShopRow({ shop }: { shop: ShopOwnerDTO }): React.JSX.Element {
    const t = useT().onboarding
    const logo = imageUrl(shop.logoKey)
    const active = shop.status === "active"
    return (
        <li>
            <button
                type="button"
                disabled={!active}
                onClick={(): void => {
                    haptic.tap()
                    openTelegramLink(`https://t.me/${shop.botUsername}`)
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
                {active ? <ChevronIcon size={18} className="text-tg-hint" /> : null}
            </button>
        </li>
    )
}

function Intro({ onStart }: { onStart(): void }): React.JSX.Element {
    const t = useT().onboarding
    useMainAction({ text: t.start, onClick: onStart })
    return <EmptyState art={<BotIcon size={44} />} title={t.title} text={t.subtitle} />
}

function Home({ shops, onAdd }: { shops: ShopOwnerDTO[]; onAdd(): void }): React.JSX.Element {
    const t = useT().onboarding
    useMainAction({ text: t.addShop, onClick: onAdd })
    return (
        <main className="px-4 pt-4">
            <Section title={t.myShops}>
                <ul className="flex flex-col gap-3">
                    {shops.map((shop) => (
                        <ShopRow key={shop.id} shop={shop} />
                    ))}
                </ul>
            </Section>
            <PoweredBy />
            <BottomSpacer />
        </main>
    )
}

/** The platform bot's Mini App: connect a shop, see my shops and their review status. */
export function OnboardingApp(): React.JSX.Element {
    const t = useT()
    const [shops, setShops] = useState<ShopOwnerDTO[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [wizard, setWizard] = useState(false)

    const load = async (): Promise<void> => {
        setError(null)
        try {
            setShops(await api.platform.myShops())
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "generic")
        }
    }
    useEffect(() => {
        applyBrand(PLATFORM_COLOR)
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
    return <Home shops={shops} onAdd={(): void => setWizard(true)} />
}

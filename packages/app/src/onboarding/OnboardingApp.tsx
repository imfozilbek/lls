import { useEffect, useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, api, imageUrl } from "../lib/api.js"
import { ZUMDA_BRAND_COLOR, applyBrand, readableInk } from "../lib/brand.js"
import { cn } from "../lib/cn.js"
import { hexToRgbChannels } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { useRefresh } from "../lib/refresh.js"
import { haptic } from "../lib/telegram.js"
import { useCachedState } from "../lib/use-cached.js"
import { toast } from "../stores/toast.js"
import { BotIcon, ChevronIcon, ShieldIcon, WifiOffIcon } from "../ui/icons.js"
import { Button, EmptyState, PoweredBy, Section, Skeleton } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import { Wizard } from "./Wizard.js"

import type { ShopOwnerDTO } from "@zumda/core"

/**
 * Tapping a shop opens its owner section right here, whatever its status: a rejected application
 * is fixed and sent again there.
 */
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
    const label = shop.rejection ? t.rejected : t.status[shop.status]
    return (
        <li>
            <button
                type="button"
                onClick={(): void => {
                    haptic.tap()
                    onOpen(shop.slug)
                }}
                className="tap flex w-full items-center gap-3 rounded-tile bg-tg-secondary p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
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
                    <span className="block truncate text-sm text-tg-hint">
                        {shop.rejection?.reason
                            ? fill(t.rejectedReason, { reason: shop.rejection.reason })
                            : `@${shop.botUsername}`}
                    </span>
                </span>
                <span
                    className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        active && "bg-success/15",
                        shop.status === "pending" && "bg-warning/15",
                        shop.status === "disabled" && "bg-danger/10",
                    )}
                >
                    {label}
                </span>
                <ChevronIcon size={18} className="text-tg-hint" />
            </button>
        </li>
    )
}

/** What the application asks, before it asks: three short steps, the rest later. */
function Intro({ onStart }: { onStart(): void }): React.JSX.Element {
    const t = useT().onboarding
    useMainAction({ text: t.start, onClick: onStart })
    return (
        <div className="flex flex-col">
            <EmptyState art={<BotIcon size={44} />} title={t.title} text={t.subtitle} />
            <ol className="-mt-6 flex flex-col gap-3 px-6">
                {t.introSteps.map((text, index) => (
                    <li
                        key={text}
                        className="flex animate-rise items-center gap-3 rounded-tile bg-tg-secondary p-3"
                        style={{ animationDelay: `${index * 60}ms` }}
                    >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink">
                            {index + 1}
                        </span>
                        <span className="font-medium">{text}</span>
                    </li>
                ))}
            </ol>
            <p className="mt-4 px-6 text-center text-sm text-tg-subtitle">{t.introAfter}</p>
        </div>
    )
}

/** Platform admins only: «Platforma» above their own businesses. */
function PlatformRow({ onOpen }: { onOpen(): void }): React.JSX.Element {
    const t = useT().platform
    return (
        <button
            type="button"
            onClick={(): void => {
                haptic.tap()
                onOpen()
            }}
            className="tap mb-6 flex w-full animate-rise items-center gap-3 rounded-tile bg-brand/10 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
            <span className="grid h-12 w-12 place-items-center rounded-control bg-brand text-brand-ink">
                <ShieldIcon size={24} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t.title}</span>
                <span className="block truncate text-sm text-tg-subtitle">{t.entryHint}</span>
            </span>
            <ChevronIcon size={18} className="text-tg-hint" />
        </button>
    )
}

function Home({
    shops,
    onAdd,
    onOpen,
    onSignOut,
    onPlatform,
}: {
    shops: ShopOwnerDTO[]
    onAdd(): void
    onOpen(slug: string): void
    onSignOut?: () => void
    /** Set for platform admins. */
    onPlatform?: () => void
}): React.JSX.Element {
    const web = useT().web
    const t = useT().onboarding
    useMainAction({ text: t.addShop, onClick: onAdd })
    return (
        <main className="px-4 pt-4">
            {onPlatform ? <PlatformRow onOpen={onPlatform} /> : null}
            <Section title={t.myShops}>
                {shops.length === 0 ? (
                    <p className="rounded-tile bg-tg-secondary p-4 text-tg-subtitle">
                        {t.noShopsYet}
                    </p>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {shops.map((shop) => (
                            <ShopRow key={shop.id} shop={shop} onOpen={onOpen} />
                        ))}
                    </ul>
                )}
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
    onPlatform,
}: {
    onOpen(slug: string): void
    /** In a browser (business.zumda.shop): sign out of this computer. */
    onSignOut?: () => void
    /** «Platforma», shown to platform admins only. */
    onPlatform(): void
}): React.JSX.Element {
    const t = useT()
    const [shops, setShops] = useCachedState<ShopOwnerDTO[]>("my-businesses")
    const [admin, setAdmin] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [wizard, setWizard] = useState(false)

    const load = async (): Promise<void> => {
        setError(null)
        try {
            const [mine, me] = await Promise.all([api.platform.myShops(), api.platform.me()])
            setAdmin(me.admin)
            setShops(mine)
        } catch (caught) {
            const code = caught instanceof ApiError ? caught.code : "generic"
            // An expired browser session: back to «sign in with Telegram».
            if (code === "UNAUTHORIZED" && onSignOut) {
                onSignOut()
                return
            }
            if (shops === null) {
                setError(code)
            } else {
                toast(errorText(t, code), "error")
            }
        }
    }
    useEffect(() => {
        applyBrand(ZUMDA_BRAND_COLOR)
        void load()
    }, [])
    useRefresh(wizard ? null : load)

    if (wizard) {
        return (
            <Wizard
                onCancel={(): void => setWizard(false)}
                onDone={(shop): void => {
                    // Straight into the new business: «Ishga tayyor» says what is next.
                    setWizard(false)
                    onOpen(shop.slug)
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
    if (shops.length === 0 && !admin) {
        return <Intro onStart={(): void => setWizard(true)} />
    }
    return (
        <Home
            shops={shops}
            onAdd={(): void => setWizard(true)}
            onOpen={onOpen}
            onSignOut={onSignOut}
            onPlatform={admin ? onPlatform : undefined}
        />
    )
}

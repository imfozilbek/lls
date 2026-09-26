import { languageFromTelegram } from "@lls/core"
import { Suspense, lazy, useCallback, useEffect, useState } from "react"

import { dictionaryFor, errorText, fill, useLanguageStore, useT } from "./i18n/index.js"
import { ApiError, api, loadCatalog, setShop } from "./lib/api.js"
import { LLS_BRAND_COLOR, applyBrand } from "./lib/brand.js"
import { useBackButton } from "./lib/main-button.js"
import { webApp } from "./lib/telegram.js"
import { CartScreen } from "./shop/CartScreen.js"
import { CheckoutScreen } from "./shop/CheckoutScreen.js"
import { MenuScreen } from "./shop/MenuScreen.js"
import { OrderScreen } from "./shop/OrderScreen.js"
import { OrdersScreen } from "./shop/OrdersScreen.js"
import { useCart } from "./stores/cart.js"
import { useCurrentRoute, useRouter } from "./stores/router.js"
import { useSession } from "./stores/session.js"
import { toast } from "./stores/toast.js"
import { BotIcon, WifiOffIcon } from "./ui/icons.js"
import { Button, EmptyState, Skeleton } from "./ui/primitives.js"
import { BottomBar, ToastHost } from "./ui/shell.js"

import type { LaunchParams } from "./lib/telegram.js"

// Customers never download these chunks.
const OwnerApp = lazy(() => import("./owner/OwnerApp.js").then((m) => ({ default: m.OwnerApp })))
const ProductEditor = lazy(() =>
    import("./owner/ProductEditor.js").then((m) => ({ default: m.ProductEditor })),
)
const CourierApp = lazy(() =>
    import("./courier/CourierApp.js").then((m) => ({ default: m.CourierApp })),
)
const ShowcaseScreen = lazy(() =>
    import("./showcase/ShowcaseScreen.js").then((m) => ({ default: m.ShowcaseScreen })),
)
const OnboardingApp = lazy(() =>
    import("./onboarding/OnboardingApp.js").then((m) => ({ default: m.OnboardingApp })),
)

type LoadState = { kind: "loading" } | { kind: "ready" } | { kind: "error"; code: string }

function MenuSkeleton(): React.JSX.Element {
    return (
        <main className="px-4 pt-4" aria-busy="true">
            <div className="flex items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-[1.1rem]" />
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-24" />
                </div>
            </div>
            <div className="mt-4 flex gap-2">
                <Skeleton className="h-8 w-32 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex flex-col gap-2">
                        <Skeleton className="aspect-[4/3] rounded-tile" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                ))}
            </div>
        </main>
    )
}

function NotInTelegram(): React.JSX.Element {
    const t = useT()
    return (
        <EmptyState
            art={<BotIcon size={44} />}
            title={t.notInTelegram.title}
            text={t.notInTelegram.text}
        />
    )
}

/**
 * Loads the shop, the user and the catalog in parallel, then paints the shop's brand.
 * A courier's screen needs no catalog, so it is skipped there.
 */
function useShopBootstrap(
    slug: string,
    options: { withCatalog: boolean; viaShowcase: boolean },
): { state: LoadState; retry(): void } {
    const { withCatalog, viaShowcase } = options
    const [state, setState] = useState<LoadState>({ kind: "loading" })
    const setLanguage = useLanguageStore((s) => s.setLanguage)

    const load = useCallback(async (): Promise<void> => {
        setState({ kind: "loading" })
        try {
            const [shop, me, products] = await Promise.all([
                api.shop(),
                api.me(),
                withCatalog ? loadCatalog() : Promise.resolve([]),
            ])
            applyBrand(shop.brandColor)
            setLanguage(me.language)
            const session = useSession.getState()
            session.setShop(shop)
            session.setMe(me)
            session.setCatalog(products)
            const removed = useCart.getState().prune(products.map((p) => p.id))
            if (removed > 0) {
                toast(fill(dictionaryFor(me.language).cart.removed, { n: removed }))
            }
            document.title = shop.name
            setState({ kind: "ready" })
        } catch (caught) {
            setState({ kind: "error", code: caught instanceof ApiError ? caught.code : "generic" })
        }
    }, [setLanguage, withCatalog])

    useEffect(() => {
        setShop(slug, { viaShowcase })
        useCart.getState().load(slug)
        void load()
    }, [slug, viaShowcase, load])

    return { state, retry: (): void => void load() }
}

function Screen(): React.JSX.Element {
    const route = useCurrentRoute()
    switch (route.name) {
        case "cart":
            return <CartScreen />
        case "checkout":
            return <CheckoutScreen />
        case "order":
            return <OrderScreen key={route.id} id={route.id} justPlaced={route.justPlaced} />
        case "orders":
            return <OrdersScreen />
        case "owner":
            return (
                <Suspense fallback={<MenuSkeleton />}>
                    <OwnerApp />
                </Suspense>
            )
        case "courier":
            return (
                <Suspense fallback={<MenuSkeleton />}>
                    <CourierApp />
                </Suspense>
            )
        case "product":
            return (
                <Suspense fallback={<MenuSkeleton />}>
                    <ProductEditor id={route.id} />
                </Suspense>
            )
        default:
            return <MenuScreen />
    }
}

function ShopApp({
    slug,
    courier = false,
    onExit,
}: {
    slug: string
    courier?: boolean
    /** Opened from the LLS showcase: "back" on the first screen returns to the search. */
    onExit?: () => void
}): React.JSX.Element {
    const t = useT()
    const { state, retry } = useShopBootstrap(slug, {
        withCatalog: !courier,
        viaShowcase: onExit !== undefined,
    })
    const depth = useRouter((s) => s.stack.length)
    const back = useRouter((s) => s.back)
    const route = useCurrentRoute()
    useBackButton(depth > 1 ? back : (onExit ?? null))

    if (state.kind === "loading") {
        return <MenuSkeleton />
    }
    if (state.kind === "error") {
        return (
            <EmptyState
                art={<WifiOffIcon size={44} />}
                title={errorText(t, state.code)}
                action={
                    state.code === "UNAUTHORIZED" ? undefined : (
                        <Button variant="secondary" onClick={retry}>
                            {t.common.retry}
                        </Button>
                    )
                }
            />
        )
    }
    // Keyed by route so each screen enters with the same soft motion.
    return (
        <div key={`${route.name}:${depth}`} className="animate-fade-in">
            <Screen />
        </div>
    )
}

/** The LLS bot: the showcase search, and a shop opened from it. */
function ShowcaseApp(): React.JSX.Element {
    const [slug, setSlug] = useState<string | null>(null)
    useEffect(() => {
        if (slug === null) {
            setShop(null)
            applyBrand(LLS_BRAND_COLOR)
            document.title = "LLS"
        }
    }, [slug])
    if (slug) {
        return (
            <ShopApp
                key={slug}
                slug={slug}
                onExit={(): void => {
                    useRouter.getState().start({ name: "menu" })
                    setSlug(null)
                }}
            />
        )
    }
    return (
        <Suspense fallback={<MenuSkeleton />}>
            <ShowcaseScreen
                onOpen={(next): void => {
                    useRouter.getState().start({ name: "menu" })
                    setSlug(next)
                }}
            />
        </Suspense>
    )
}

export function App({ launch }: { launch: LaunchParams }): React.JSX.Element {
    let content: React.JSX.Element
    if (!webApp()) {
        content = <NotInTelegram />
    } else if (launch.onboarding) {
        content = (
            <Suspense fallback={<MenuSkeleton />}>
                <OnboardingApp />
            </Suspense>
        )
    } else if (launch.market) {
        content = <ShowcaseApp />
    } else if (launch.shop) {
        content = <ShopApp slug={launch.shop} courier={launch.courier} />
    } else {
        content = <NotInTelegram />
    }
    return (
        <>
            {content}
            <BottomBar />
            <ToastHost />
        </>
    )
}

/** Language before the profile loads: the one Telegram reports. */
export function initialLanguage(): void {
    const code = webApp()?.initDataUnsafe.user?.language_code
    useLanguageStore.getState().setLanguage(languageFromTelegram(code))
}

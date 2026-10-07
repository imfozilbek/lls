import { languageFromTelegram } from "@zumda/core"
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react"

import { clearSession, loadSession, saveSession } from "./business/web-session.js"
import { dictionaryFor, errorText, fill, useLanguageStore, useT } from "./i18n/index.js"
import {
    ApiError,
    api,
    loadCatalog,
    onWebSessionExpired,
    setShop,
    setWebSession,
} from "./lib/api.js"
import { ZUMDA_BRAND_COLOR, ZUMDA_NAME, applyBrand } from "./lib/brand.js"
import { useBackButton } from "./lib/main-button.js"
import { useRefresh } from "./lib/refresh.js"
import { webApp } from "./lib/telegram.js"
import { CartScreen } from "./shop/CartScreen.js"
import { MenuScreen } from "./shop/MenuScreen.js"
import { useCart } from "./stores/cart.js"
import { useCurrentRoute, useRouter } from "./stores/router.js"
import { useSession } from "./stores/session.js"
import { toast } from "./stores/toast.js"
import { Gestures } from "./ui/gestures.js"
import { BotIcon, StoreIcon, WifiOffIcon } from "./ui/icons.js"
import { Button, EmptyState, Skeleton } from "./ui/primitives.js"
import { Settle } from "./ui/settle.js"
import { BottomBar, ToastHost, WebBackBar } from "./ui/shell.js"

import type { ShopVia, WebSession } from "./lib/api.js"
import type { AdminTarget, LaunchParams } from "./lib/telegram.js"
import type { Direction } from "./stores/router.js"

/**
 * After the menu: checkout, the order and the order list are their own chunks, so the first
 * screen opens faster on slow regional internet. They load in the background right after the
 * shop is up, long before the customer taps through to them.
 */
const loadCheckout = (): Promise<typeof import("./shop/CheckoutScreen.js")> =>
    import("./shop/CheckoutScreen.js")
const loadOrder = (): Promise<typeof import("./shop/OrderScreen.js")> =>
    import("./shop/OrderScreen.js")
const loadOrders = (): Promise<typeof import("./shop/OrdersScreen.js")> =>
    import("./shop/OrdersScreen.js")
const CheckoutScreen = lazy(() => loadCheckout().then((m) => ({ default: m.CheckoutScreen })))
const OrderScreen = lazy(() => loadOrder().then((m) => ({ default: m.OrderScreen })))
const OrdersScreen = lazy(() => loadOrders().then((m) => ({ default: m.OrdersScreen })))
/** Rare (a Zumda Shop QR of a shop that left the showcase): its own chunk. */
const OutsideShowcase = lazy(() =>
    import("./shop/OutsideShowcase.js").then((m) => ({ default: m.OutsideShowcase })),
)

/** A moment after the shop is on screen, so the menu's own requests go first. */
const PREFETCH_AFTER_MS = 800

function usePrefetchScreens(ready: boolean): void {
    useEffect(() => {
        if (!ready) {
            return undefined
        }
        const timer = window.setTimeout(() => {
            void Promise.all([loadCheckout(), loadOrder(), loadOrders()]).catch(() => undefined)
        }, PREFETCH_AFTER_MS)
        return (): void => window.clearTimeout(timer)
    }, [ready])
}

// Customers never download these chunks, nor the staff's words they bring (`staff-register`).
const withStaff = <T,>(load: () => Promise<T>): Promise<T> =>
    import("./i18n/staff-register.js").then(load)
const OwnerApp = lazy(() =>
    withStaff(() => import("./owner/OwnerApp.js")).then((m) => ({ default: m.OwnerApp })),
)
const ProductEditor = lazy(() =>
    withStaff(() => import("./owner/ProductEditor.js")).then((m) => ({
        default: m.ProductEditor,
    })),
)
const CourierApp = lazy(() =>
    withStaff(() => import("./courier/CourierApp.js")).then((m) => ({ default: m.CourierApp })),
)
const ShowcaseScreen = lazy(() =>
    withStaff(() => import("./showcase/ShowcaseScreen.js")).then((m) => ({
        default: m.ShowcaseScreen,
    })),
)
const WebSignIn = lazy(() =>
    import("./business/WebSignIn.js").then((m) => ({ default: m.WebSignIn })),
)
const OnboardingApp = lazy(() =>
    withStaff(() => import("./onboarding/OnboardingApp.js")).then((m) => ({
        default: m.OnboardingApp,
    })),
)
const PlatformApp = lazy(() =>
    withStaff(() => import("./platform/PlatformApp.js")).then((m) => ({ default: m.PlatformApp })),
)

const SCREEN_IN: Record<Direction, string> = {
    forward: "animate-screen-forward",
    back: "animate-screen-back",
    none: "animate-screen-in",
}

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

/** Loads the shop, the user and the catalog in parallel, then paints the shop's brand. */
function useShopBootstrap(
    slug: string,
    via?: ShopVia,
): { state: LoadState; retry(): void; refresh(): Promise<void> } {
    const [state, setState] = useState<LoadState>({ kind: "loading" })
    const setLanguage = useLanguageStore((s) => s.setLanguage)
    // Only the latest load may touch the screen: a slow answer for the shop left behind must not
    // empty this shop's cart or paint its brand.
    const latest = useRef(0)

    /** `silent`: a pull to refresh, the shop stays on screen while it reloads. */
    const load = useCallback(
        async (silent = false): Promise<void> => {
            const attempt = ++latest.current
            if (!silent) {
                setState({ kind: "loading" })
            }
            try {
                const [shop, me, products] = await Promise.all([
                    api.shop(),
                    api.me(),
                    loadCatalog(),
                ])
                if (attempt !== latest.current) {
                    return
                }
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
                if (silent && attempt === latest.current) {
                    toast(
                        errorText(
                            dictionaryFor(useLanguageStore.getState().language),
                            caught instanceof ApiError ? caught.code : "generic",
                        ),
                        "error",
                    )
                    return
                }
                if (attempt === latest.current) {
                    setState({
                        kind: "error",
                        code: caught instanceof ApiError ? caught.code : "generic",
                    })
                }
            }
        },
        [setLanguage],
    )

    useEffect(() => {
        setShop(slug, { via })
        useCart.getState().load(slug)
        void load()
        return (): void => {
            latest.current++
        }
    }, [slug, via, load])

    return { state, retry: (): void => void load(), refresh: (): Promise<void> => load(true) }
}

function Screen(): React.JSX.Element {
    const route = useCurrentRoute()
    switch (route.name) {
        case "cart":
            return <CartScreen />
        case "checkout":
            return (
                <Suspense fallback={null}>
                    <CheckoutScreen />
                </Suspense>
            )
        case "order":
            return (
                <Suspense fallback={null}>
                    <OrderScreen key={route.id} id={route.id} justPlaced={route.justPlaced} />
                </Suspense>
            )
        case "orders":
            return (
                <Suspense fallback={null}>
                    <OrdersScreen />
                </Suspense>
            )
        case "owner":
            return (
                <Suspense fallback={<MenuSkeleton />}>
                    <OwnerApp />
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

/**
 * A bot message's «Buyurtmani ochish»: the owner lands on the order in «Buyurtmalar», a customer
 * on its tracking screen. Once, when the shop has loaded.
 */
function useOpenOrder(ready: boolean, orderId: string | undefined): void {
    const [done, setDone] = useState(false)
    useEffect(() => {
        if (!ready || !orderId || done) {
            return
        }
        setDone(true)
        const router = useRouter.getState()
        if (useSession.getState().shop?.viewerRole === "owner") {
            void import("./owner/store.js")
                .then(({ useOwner }) => {
                    useOwner.getState().focusOrder(orderId)
                })
                .catch(() => undefined)
                .finally(() => router.start({ name: "owner" }))
            return
        }
        router.start({ name: "menu" })
        router.push({ name: "order", id: orderId })
    }, [ready, orderId, done])
}

function ShopApp({
    slug,
    via,
    order,
    onExit,
}: {
    slug: string
    /** Opened inside a Zumda bot: the showcase, or «Mening bizneslarim» in Zumda Business. */
    via?: ShopVia
    /** Opened from a bot message about this order. */
    order?: string
    /** Inside a Zumda bot: "back" on the first screen returns to the search or the list. */
    onExit?: () => void
}): React.JSX.Element {
    const t = useT()
    const { state, retry, refresh } = useShopBootstrap(slug, via)
    const depth = useRouter((s) => s.stack.length)
    const back = useRouter((s) => s.back)
    const route = useCurrentRoute()
    useBackButton(depth > 1 ? back : (onExit ?? null))
    useOpenOrder(state.kind === "ready", order)
    usePrefetchScreens(state.kind === "ready")
    // The storefront's own pull: shop, profile and catalog again, the menu stays on screen.
    useRefresh(state.kind === "ready" ? refresh : null)
    const direction = useRouter((s) => s.direction)

    if (state.kind === "loading") {
        return <MenuSkeleton />
    }
    if (state.kind === "error" && state.code === "ENTITY_NOT_FOUND" && via === "marketplace") {
        return (
            <Suspense fallback={<MenuSkeleton />}>
                <OutsideShowcase slug={slug} onExit={onExit} />
            </Suspense>
        )
    }
    if (state.kind === "error" && state.code === "ENTITY_NOT_FOUND") {
        // A wrong link, or a shop that is not approved yet: retrying will not help.
        return (
            <EmptyState
                art={<StoreIcon size={44} />}
                title={t.shop.notFoundTitle}
                text={t.shop.notFoundText}
            />
        )
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
    // Keyed by route: a new screen slides in from the side it comes from, never from blank.
    return (
        <Settle key={`${route.name}:${depth}`} id={route.name} className={SCREEN_IN[direction]}>
            <Screen />
        </Settle>
    )
}

/** The Zumda bot: the showcase search, and a shop opened from it (or from a message). */
function ShowcaseApp({
    shop,
    order,
}: {
    shop: string | null
    order: string | null
}): React.JSX.Element {
    const [slug, setSlug] = useState<string | null>(shop)
    useEffect(() => {
        if (slug === null) {
            setShop(null)
            applyBrand(ZUMDA_BRAND_COLOR)
            document.title = ZUMDA_NAME
        }
    }, [slug])
    if (slug) {
        return (
            <ShopApp
                key={slug}
                slug={slug}
                via="marketplace"
                order={slug === shop ? (order ?? undefined) : undefined}
                onExit={(): void => {
                    setShop(null)
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

/**
 * The Zumda Business bot's «Mening bizneslarim»: every shop of the owner, and the owner section of one of
 * them right here, without opening that shop's own bot.
 */
function BusinessesApp({
    onSignOut,
    adminTarget = null,
}: {
    onSignOut?: () => void
    /** An admin's bot message: open «Platforma» on this. */
    adminTarget?: AdminTarget | null
}): React.JSX.Element {
    const [slug, setSlug] = useState<string | null>(null)
    const [platform, setPlatform] = useState(adminTarget !== null)
    useEffect(() => {
        if (slug === null) {
            setShop(null, { via: "business" })
            applyBrand(ZUMDA_BRAND_COLOR)
            document.title = ZUMDA_NAME
        }
    }, [slug, platform])
    if (platform) {
        return (
            <Suspense fallback={<MenuSkeleton />}>
                <PlatformApp target={adminTarget} onExit={(): void => setPlatform(false)} />
            </Suspense>
        )
    }
    if (slug) {
        return (
            <ShopApp
                key={slug}
                slug={slug}
                via="business"
                onExit={(): void => {
                    // Before the list renders: its first request must not carry this shop.
                    setShop(null, { via: "business" })
                    useRouter.getState().start({ name: "menu" })
                    setSlug(null)
                }}
            />
        )
    }
    return (
        <Suspense fallback={<MenuSkeleton />}>
            <OnboardingApp
                onSignOut={onSignOut}
                onPlatform={(): void => setPlatform(true)}
                onOpen={(next): void => {
                    useRouter.getState().start({ name: "owner" })
                    setSlug(next)
                }}
            />
        </Suspense>
    )
}

/**
 * business.zumda.shop in a browser: sign in with Telegram once, then the same «Mening
 * bizneslarim» and owner section as inside the Zumda | Business bot.
 */
function WebBusinessApp({ adminTarget }: { adminTarget: AdminTarget | null }): React.JSX.Element {
    const [session, setSession] = useState<WebSession | null>(() => loadSession())
    setWebSession(session?.token ?? null)
    useEffect(() => {
        onWebSessionExpired((): void => {
            clearSession()
            setWebSession(null)
            setSession(null)
        })
        return (): void => onWebSessionExpired(null)
    }, [])
    if (!session) {
        return (
            <Suspense fallback={<MenuSkeleton />}>
                <WebSignIn
                    onSignedIn={(next): void => {
                        saveSession(next)
                        setSession(next)
                    }}
                />
            </Suspense>
        )
    }
    return (
        <>
            <WebBackBar />
            <BusinessesApp
                adminTarget={adminTarget}
                onSignOut={(): void => {
                    clearSession()
                    setWebSession(null)
                    setSession(null)
                }}
            />
        </>
    )
}

export function App({ launch }: { launch: LaunchParams }): React.JSX.Element {
    let content: React.JSX.Element
    if (!webApp()) {
        content = launch.business ? (
            <WebBusinessApp adminTarget={launch.admin} />
        ) : (
            <NotInTelegram />
        )
    } else if (launch.business) {
        content = <BusinessesApp adminTarget={launch.admin} />
    } else if (launch.courier) {
        // The Zumda courier bot: one screen across every shop the courier delivers for.
        content = (
            <Suspense fallback={<MenuSkeleton />}>
                <CourierApp />
            </Suspense>
        )
    } else if (launch.market) {
        content = <ShowcaseApp shop={launch.shop} order={launch.order} />
    } else if (launch.shop) {
        content = <ShopApp slug={launch.shop} order={launch.order ?? undefined} />
    } else {
        content = <NotInTelegram />
    }
    return (
        <>
            {content}
            <Gestures />
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

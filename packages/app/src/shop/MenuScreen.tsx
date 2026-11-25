import { StorefrontLayout, searchWords } from "@zumda/core"
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useLanguage, useT } from "../i18n/index.js"
import { formatMoney } from "../lib/format.js"
import { useMainAction } from "../lib/main-button.js"
import { summarize, useCart } from "../stores/cart.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { SheetLoading } from "../ui/boundary.js"
import { BagIcon, SearchIcon } from "../ui/icons.js"
import { EmptyState, PoweredBy } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import { CatalogSearch, SEARCH_FROM, matches } from "./catalog-search.js"
import { menuChips } from "./menu-chips.js"
import { NEW_CHIP, newShelf, resolveLayout, underChip, viewOf } from "./menu-layout.js"
import { CategoryChips, FeedView, GridView, ListView, ShelvesView } from "./menu-views.js"
import { useFocusedProduct, useProductDetail } from "./product-cards.js"
import { ShopHeader } from "./shop-header.js"

import type { ProductDTO } from "@zumda/core"

/** The product up close: its own chunk, loaded while the customer looks at the menu. */
const loadProductSheet = (): Promise<typeof import("./ProductSheet.js")> =>
    import("./ProductSheet.js")
const ProductSheet = lazy(() => loadProductSheet().then((m) => ({ default: m.ProductSheet })))
/** Long enough for the menu's own pictures to come first on a slow line. */
const SHEET_PRELOAD_MS = 1500

/**
 * The storefront's tabs: the ages and categories (`menuChips`), and on the shelves «Yangi
 * kelganlar» while its shelf is there, so «Hammasini ko'rish» has a tab to come back from.
 */
function storefrontTabs(catalog: readonly ProductDTO[], layout: StorefrontLayout): string[] {
    const tabs = menuChips(catalog)
    const news = layout === StorefrontLayout.SHELVES && newShelf(catalog).length > 0
    return news ? [NEW_CHIP, ...tabs] : tabs
}

/** What the screen shows under the tabs: the catalog in the shop's layout, or why nothing. */
function CatalogBody({
    catalog,
    visible,
    layout,
    narrowed,
    tabs,
    onChip,
}: {
    catalog: readonly ProductDTO[]
    visible: readonly ProductDTO[]
    layout: StorefrontLayout
    narrowed: boolean
    tabs: readonly string[]
    onChip(chip: string): void
}): React.JSX.Element {
    const t = useT()
    if (catalog.length === 0) {
        return (
            <EmptyState
                art={<BagIcon size={44} />}
                title={t.shop.emptyTitle}
                text={t.shop.emptyText}
            />
        )
    }
    if (visible.length === 0) {
        return (
            <EmptyState
                art={<SearchIcon size={44} />}
                title={t.shop.nothingFound}
                text={t.shop.nothingFoundText}
            />
        )
    }
    switch (viewOf(layout, narrowed)) {
        case StorefrontLayout.SHELVES:
            return <ShelvesView catalog={catalog} tabs={tabs} onChip={onChip} />
        case StorefrontLayout.LIST:
            return <ListView products={visible} grouped={!narrowed} />
        case StorefrontLayout.FEED:
            return <FeedView products={visible} />
        case StorefrontLayout.GRID:
            return <GridView products={visible} />
    }
}

/**
 * The tabs, or the search field in their place (goal 24): a long catalog searches from the
 * magnifier at the start of the tabs, so the top of the storefront stays short.
 */
function TabsOrSearch({
    catalog,
    tabs,
    active,
    query,
    onQuery,
    onTab,
}: {
    catalog: readonly ProductDTO[]
    tabs: string[]
    active: string | null
    query: string
    onQuery(query: string): void
    onTab(tab: string | null): void
}): React.JSX.Element | null {
    const [searching, setSearching] = useState(false)
    const closeSearch = useCallback((): void => {
        onQuery("")
        setSearching(false)
    }, [onQuery])
    if (searching) {
        return (
            <CatalogSearch
                value={query}
                onChange={onQuery}
                onClose={closeSearch}
                className="pb-1 pt-2.5"
            />
        )
    }
    return (
        <CategoryChips
            categories={tabs}
            active={active}
            onChange={onTab}
            onSearch={
                catalog.length > SEARCH_FROM
                    ? (): void => {
                          // The search looks through the whole catalog, not one tab.
                          onTab(null)
                          setSearching(true)
                      }
                    : undefined
            }
        />
    )
}

export function MenuScreen(): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const shop = useSession((state) => state.shop)
    const catalog = useSession((state) => state.catalog)
    const lines = useCart((state) => state.lines)
    const push = useRouter((state) => state.push)
    const [category, setCategory] = useState<string | null>(null)
    const [query, setQuery] = useState("")
    const catalogTop = useRef<HTMLDivElement>(null)
    // The first tap on a product opens its sheet at once, even on a slow network.
    useEffect(() => {
        const timer = window.setTimeout(
            () => void loadProductSheet().catch(() => undefined),
            SHEET_PRELOAD_MS,
        )
        return (): void => window.clearTimeout(timer)
    }, [])

    // The shop's choice, or the photos' while it made none (goal 24).
    const layout = resolveLayout(shop?.storefrontLayout ?? null, catalog)
    const tabs = useMemo(() => storefrontTabs(catalog, layout), [catalog, layout])
    // A tab that left the catalog (after a refresh) never keeps filtering it empty.
    const active = category && tabs.includes(category) ? category : null
    const words = searchWords(query)
    const visible = catalog.filter(
        (p) => (!active || underChip(p, active)) && (words.length === 0 || matches(p, words)),
    )
    const cart = summarize(lines, catalog)

    const detail = useProductDetail((state) => state.product)
    useFocusedProduct(catalog)
    // Leaving the menu closes the product: it never pops open again on the next visit.
    useEffect(() => (): void => useProductDetail.getState().show(null), [])

    useMainAction(
        cart.count > 0
            ? {
                  text: `${t.cart.button} · ${cart.count} · ${formatMoney(cart.subtotal, language)}`,
                  onClick: (): void => push({ name: "cart" }),
              }
            : null,
    )

    if (!shop) {
        return <></>
    }
    return (
        <main>
            <ShopHeader shop={shop} />
            <div ref={catalogTop} className="scroll-mt-0" />
            <TabsOrSearch
                catalog={catalog}
                tabs={tabs}
                active={active}
                query={query}
                onQuery={setQuery}
                onTab={setCategory}
            />
            <CatalogBody
                catalog={catalog}
                visible={visible}
                layout={layout}
                narrowed={active !== null || words.length > 0}
                tabs={tabs}
                onChip={(chip): void => {
                    setCategory(chip)
                    // The tab's products start right under the tabs.
                    catalogTop.current?.scrollIntoView({ block: "start" })
                }}
            />
            {detail ? (
                <Suspense fallback={<SheetLoading />}>
                    <ProductSheet
                        product={detail}
                        onClose={(): void => useProductDetail.getState().show(null)}
                    />
                </Suspense>
            ) : null}
            <PoweredBy />
            <BottomSpacer />
        </main>
    )
}

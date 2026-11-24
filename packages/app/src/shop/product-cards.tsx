import { isWeightUnit } from "@zumda/core"
import { useEffect } from "react"
import { create } from "zustand"

import { fill, useLanguage, useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { formatMoney, formatQuantity } from "../lib/format.js"
import { haptic } from "../lib/telegram.js"
import { productOfKey, useCart } from "../stores/cart.js"
import { useSession } from "../stores/session.js"
import { PlusIcon } from "../ui/icons.js"
import { Stepper } from "../ui/primitives.js"
import { ProductImage } from "../ui/product-image.js"

import { AgeBadge } from "./age-badge.js"
import { PhotoStrip, photoKeys } from "./photo-strip.js"
import { hasOptions } from "./product-options.js"

import type { ProductDTO } from "@zumda/core"

const GLOW_MS = 1800

/** The product opened up close, and the one a showcase tap asked for (it glows a moment). */
export const useProductDetail = create<{
    product: ProductDTO | null
    glowId: string | null
    show(product: ProductDTO | null): void
    glow(id: string | null): void
}>((set) => ({
    product: null,
    glowId: null,
    show: (product): void => set({ product }),
    glow: (glowId): void => set({ glowId }),
}))

function openDetail(product: ProductDTO): void {
    haptic.tap()
    useProductDetail.getState().show(product)
}

/** How much of a product is in the cart: every pick of it together when it has options. */
function useInCart(product: ProductDTO): number {
    return useCart((state) =>
        hasOptions(product)
            ? Object.entries(state.lines).reduce(
                  (sum, [key, quantity]) =>
                      productOfKey(key) === product.id ? sum + quantity : sum,
                  0,
              )
            : (state.lines[product.id] ?? 0),
    )
}

/** «/ porsiya», or «dan» for a product whose variants cost differently (from the cheapest). */
function PriceLine({ product }: { product: ProductDTO }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const prices = new Set(product.options?.variants.map((v) => v.price))
    const unit = (t.units as Record<string, string>)[product.unit] ?? product.unit
    return (
        <p className="mt-0.5 text-sm">
            <span className="font-semibold">{formatMoney(product.price, language)}</span>
            <span className="text-tg-hint">
                {prices.size > 1 ? ` ${t.shop.from}` : ` / ${unit}`}
            </span>
            <AgeBadge product={product} />
        </p>
    )
}

/** A product with options is picked in its sheet: its «+» opens it and shows how many are in. */
function PickButton({
    product,
    quantity,
    className,
}: {
    product: ProductDTO
    quantity: number
    className: string
}): React.JSX.Element {
    const t = useT()
    return (
        <button
            type="button"
            onClick={(): void => openDetail(product)}
            aria-label={`${t.shop.add}: ${product.name}`}
            className={cn("tap grid place-items-center rounded-full", className)}
        >
            {quantity > 0 ? (
                // Weight items count grams: «1,5 kg», never «1500».
                <span
                    className={cn(
                        "font-bold tabular-nums",
                        isWeightUnit(product.unit) ? "text-[0.7rem] leading-tight" : "text-sm",
                    )}
                >
                    {formatQuantity(quantity, product.unit, t.units)}
                </span>
            ) : (
                <PlusIcon size={22} strokeWidth={2.25} />
            )}
        </button>
    )
}

/**
 * The two looks of the control: floating over a photo (always white, lifted), or at the end of a
 * row inside a card.
 */
const CONTROL_LOOK = {
    photo: {
        place: "absolute bottom-2 right-2",
        round: "h-11 w-11 bg-tg-section text-brand shadow-raised",
        mark: "h-9 bg-tg-section shadow-raised",
    },
    row: {
        place: "shrink-0",
        round: "h-11 w-11 bg-brand/10 text-brand",
        mark: "h-9 bg-tg-bg",
    },
}

/**
 * «+», the stepper, or the sheet for a product with options; a counted product that ran out shows
 * «Tugagan» in their place (owner's decision, November 2026): seen as it is, never added.
 */
function CartControl({
    product,
    look,
}: {
    product: ProductDTO
    look: keyof typeof CONTROL_LOOK
}): React.JSX.Element {
    const t = useT()
    const quantity = useInCart(product)
    const add = useCart((state) => state.add)
    const remove = useCart((state) => state.remove)
    const style = CONTROL_LOOK[look]
    if (product.soldOut) {
        return (
            <span
                className={cn(
                    "inline-flex items-center rounded-full px-3 text-sm font-semibold text-tg-subtitle",
                    style.place,
                    style.mark,
                )}
            >
                {t.shop.soldOut}
            </span>
        )
    }
    if (hasOptions(product)) {
        return (
            <PickButton
                product={product}
                quantity={quantity}
                className={cn(style.place, style.round)}
            />
        )
    }
    if (quantity === 0) {
        return (
            <button
                type="button"
                onClick={(): void => {
                    haptic.tap()
                    add(product.id, product.step)
                }}
                aria-label={`${t.shop.add}: ${product.name}`}
                className={cn("tap grid place-items-center rounded-full", style.place, style.round)}
            >
                <PlusIcon size={22} strokeWidth={2.25} />
            </button>
        )
    }
    return (
        <div className={style.place}>
            <Stepper
                quantity={quantity}
                display={formatQuantity(quantity, product.unit, t.units)}
                onAdd={(): void => add(product.id, product.step)}
                onRemove={(): void => remove(product.id, product.step)}
                label={product.name}
            />
        </div>
    )
}

export function productAnchor(id: string): string {
    return `product-${id}`
}

/**
 * Opened on one product (a showcase tap, a channel post): bring it into view and make it glow
 * once; a post's or an ad link's product opens up close too.
 */
export function useFocusedProduct(catalog: readonly ProductDTO[]): void {
    const focusId = useSession((state) => state.focusProductId)
    useEffect(() => {
        const product = focusId ? catalog.find((candidate) => candidate.id === focusId) : null
        if (!focusId || !product) {
            return undefined
        }
        if (useSession.getState().focusOpen) {
            useProductDetail.getState().show(product)
        }
        useSession.getState().focusProduct(null)
        const frame = window.requestAnimationFrame(() => {
            document
                .getElementById(productAnchor(focusId))
                ?.scrollIntoView({ behavior: "smooth", block: "center" })
            useProductDetail.getState().glow(focusId)
        })
        const timer = window.setTimeout(() => useProductDetail.getState().glow(null), GLOW_MS)
        return (): void => {
            window.cancelAnimationFrame(frame)
            window.clearTimeout(timer)
        }
    }, [focusId, catalog])
}

function useGlowing(product: ProductDTO): boolean {
    return useProductDetail((state) => state.glowId === product.id)
}

/** The ring of the product a tap asked for: around the card, clear of the page's gray. */
const GLOW = "ring-2 ring-brand ring-offset-2 ring-offset-tg-bg"

/**
 * «Ikki ustunda»: a white card, the photo flush at its top with the «+» over it, the name and the
 * price under it. Also a card on a shelf (`className`), anchored only where it stands first.
 */
export function ProductTile({
    product,
    index = 0,
    className,
    anchored = true,
}: {
    product: ProductDTO
    index?: number
    className?: string
    anchored?: boolean
}): React.JSX.Element {
    const glowing = useGlowing(product)
    return (
        <article
            id={anchored ? productAnchor(product.id) : undefined}
            className={cn(
                "flex animate-rise scroll-mt-28 flex-col overflow-hidden rounded-tile bg-tg-secondary transition-shadow duration-500",
                glowing && GLOW,
                className,
            )}
            style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
        >
            <div className="relative">
                <ProductImage
                    imageKey={product.imageKey}
                    category={product.category}
                    alt={product.name}
                    name={product.name}
                    className="aspect-square w-full"
                />
                <CartControl product={product} look="photo" />
            </div>
            <button
                type="button"
                onClick={(): void => openDetail(product)}
                className="tap flex flex-1 flex-col px-3 pb-3 pt-2 text-left"
            >
                <h3 className="line-clamp-2 font-medium leading-snug">{product.name}</h3>
                <span className="mt-auto pt-0.5">
                    <PriceLine product={product} />
                </span>
            </button>
        </article>
    )
}

/**
 * «Ro'yxat ko'rinishida»: one row of a category's card, the photo small on its inner gray (a
 * white background keeps its edge), the same «+» and stepper at the end.
 */
export function ProductRow({ product }: { product: ProductDTO }): React.JSX.Element {
    const glowing = useGlowing(product)
    return (
        <li
            id={productAnchor(product.id)}
            className={cn(
                "flex animate-rise scroll-mt-28 items-center gap-3 px-3 py-3 transition-shadow duration-500",
                // Rounded only while it glows: a rounded row bends the dividers between rows.
                glowing && cn("rounded-tile", GLOW),
            )}
        >
            <ProductImage
                imageKey={product.imageKey}
                category={product.category}
                alt={product.name}
                iconSize={22}
                inset
                className="h-16 w-16 shrink-0 rounded-control"
            />
            <button
                type="button"
                onClick={(): void => openDetail(product)}
                className="tap min-w-0 flex-1 rounded-control text-left"
            >
                <h3 className="line-clamp-2 font-medium leading-snug">{product.name}</h3>
                {product.description ? (
                    <p className="line-clamp-1 text-sm text-tg-hint">{product.description}</p>
                ) : null}
                <PriceLine product={product} />
            </button>
            <CartControl product={product} look="row" />
        </li>
    )
}

/**
 * «Katta rasm bilan»: one product a row, its photos swiped sideways, the description longer. A
 * product without a photo is the card without a picture, its «+» beside the name.
 */
export function FeedCard({
    product,
    index,
}: {
    product: ProductDTO
    index: number
}): React.JSX.Element {
    const t = useT()
    const glowing = useGlowing(product)
    const pictured = photoKeys(product).length > 0
    return (
        <article
            id={productAnchor(product.id)}
            className={cn(
                "animate-rise scroll-mt-28 overflow-hidden rounded-tile bg-tg-secondary transition-shadow duration-500",
                glowing && GLOW,
            )}
            style={{ animationDelay: `${Math.min(index, 4) * 40}ms` }}
        >
            <PhotoStrip
                product={product}
                frame="aspect-square"
                dotLabel={(n): string => `${product.name}: ${fill(t.shop.photoOf, { n })}`}
            >
                <CartControl product={product} look="photo" />
            </PhotoStrip>
            <div className="flex items-start gap-3 px-4 pb-4 pt-3">
                <button
                    type="button"
                    onClick={(): void => openDetail(product)}
                    className="tap min-w-0 flex-1 rounded-control text-left"
                >
                    <h3 className="text-lg font-semibold leading-snug">{product.name}</h3>
                    {product.description ? (
                        <p className="mt-1 line-clamp-3 text-tg-hint">{product.description}</p>
                    ) : null}
                    <PriceLine product={product} />
                </button>
                {pictured ? null : <CartControl product={product} look="row" />}
            </div>
        </article>
    )
}

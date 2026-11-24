import { useRef, useState } from "react"

import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"
import { ProductImage } from "../ui/product-image.js"

import type { ProductDTO } from "@zumda/core"

function prefersStill(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** The product's photos: the main one first, then the others (up to three). */
export function photoKeys(product: ProductDTO): string[] {
    return product.imageKey ? [product.imageKey, ...(product.moreImageKeys ?? [])] : []
}

/**
 * A photo a finger presses to open its product, as the name under it does (goal 24). Kept from
 * screen readers and the keyboard: the name's button is theirs, so nothing is heard twice. It
 * dims while pressed and never moves: a swipe through the photos starts on it too.
 */
export function PhotoPress({
    onPress,
    className,
    children,
}: {
    onPress(): void
    className?: string
    children: React.ReactNode
}): React.JSX.Element {
    return (
        <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={onPress}
            className={cn(
                "block transition-[filter] duration-150 ease-out active:brightness-90",
                className,
            )}
        >
            {children}
        </button>
    )
}

/** One photo in its `place`: pressable when the card opens the product. */
function StripPhoto({
    product,
    imageKey,
    alt,
    place,
    onOpen,
}: {
    product: ProductDTO
    imageKey: string
    alt: string
    place: string
    onOpen: (() => void) | undefined
}): React.JSX.Element {
    const image = (
        <ProductImage
            imageKey={imageKey}
            category={product.category}
            alt={alt}
            className={onOpen ? "h-full w-full" : place}
        />
    )
    return onOpen ? (
        <PhotoPress onPress={onOpen} className={place}>
            {image}
        </PhotoPress>
    ) : (
        image
    )
}

/** A dot for each photo: the one shown is long, a press brings the photo it stands for. */
function PhotoDots({
    keys,
    shown,
    dotLabel,
    onGo,
}: {
    keys: readonly string[]
    shown: number
    dotLabel(n: number): string
    onGo(index: number): void
}): React.JSX.Element {
    return (
        <div className="flex justify-center">
            {keys.map((key, index) => (
                <button
                    key={key}
                    type="button"
                    aria-label={dotLabel(index + 1)}
                    aria-current={index === shown}
                    onClick={(): void => onGo(index)}
                    className="tap grid h-11 w-11 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                    <span
                        className={cn(
                            "h-2 rounded-full transition-all duration-300 ease-out motion-reduce:transition-none",
                            index === shown ? "w-5 bg-brand" : "w-2 bg-tg-hint/40",
                        )}
                    />
                </button>
            ))}
        </div>
    )
}

/**
 * A product's photos side by side (owner's decision, November 2026: up to three): one photo as
 * it is; more, a strip swiped sideways with a dot for each. A sideways scroller keeps the page's
 * own swipe («back») off by itself; `ownsSwipe` also keeps pull-to-refresh out (the sheet).
 */
export function PhotoStrip({
    product,
    frame,
    dotLabel,
    ownsSwipe = false,
    onOpen,
    children,
}: {
    product: ProductDTO
    /** The size and corners of each photo, e.g. `aspect-square`. */
    frame: string
    /** What a screen reader hears for the n-th dot (and the n-th photo's name). */
    dotLabel(n: number): string
    ownsSwipe?: boolean
    /** A press on a photo opens the product (the storefront's cards; never the sheet itself). */
    onOpen?: () => void
    /** Drawn over the photos (the «+», the age). */
    children?: React.ReactNode
}): React.JSX.Element | null {
    const strip = useRef<HTMLDivElement>(null)
    const [shown, setShown] = useState(0)
    const keys = photoKeys(product)
    if (keys.length === 0) {
        return null
    }
    if (keys.length === 1) {
        return (
            <div className="relative">
                <StripPhoto
                    product={product}
                    imageKey={keys[0] ?? ""}
                    alt={product.name}
                    place={cn("w-full", frame)}
                    onOpen={onOpen}
                />
                {children}
            </div>
        )
    }
    const go = (index: number): void => {
        const box = strip.current
        if (box) {
            haptic.select()
            box.scrollTo({
                left: index * box.clientWidth,
                behavior: prefersStill() ? "auto" : "smooth",
            })
        }
    }
    return (
        <div>
            <div className="relative">
                <div
                    ref={strip}
                    data-no-gesture={ownsSwipe || undefined}
                    onScroll={(): void => {
                        const box = strip.current
                        if (box && box.clientWidth > 0) {
                            setShown(Math.round(box.scrollLeft / box.clientWidth))
                        }
                    }}
                    className={cn(
                        "flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                        frame,
                    )}
                >
                    {keys.map((key, index) => (
                        <StripPhoto
                            key={key}
                            product={product}
                            imageKey={key}
                            alt={`${product.name}: ${dotLabel(index + 1)}`}
                            place="h-full w-full shrink-0 snap-center"
                            onOpen={onOpen}
                        />
                    ))}
                </div>
                {children}
            </div>
            <PhotoDots keys={keys} shown={shown} dotLabel={dotLabel} onGo={go} />
        </div>
    )
}

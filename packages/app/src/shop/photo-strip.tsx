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
 * A product's photos side by side (owner's decision, November 2026: up to three): one photo as
 * it is; more, a strip swiped sideways with a dot for each. A sideways scroller keeps the page's
 * own swipe («back») off by itself; `ownsSwipe` also keeps pull-to-refresh out (the sheet).
 */
export function PhotoStrip({
    product,
    frame,
    dotLabel,
    ownsSwipe = false,
    children,
}: {
    product: ProductDTO
    /** The size and corners of each photo, e.g. `aspect-square`. */
    frame: string
    /** What a screen reader hears for the n-th dot (and the n-th photo's name). */
    dotLabel(n: number): string
    ownsSwipe?: boolean
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
                <ProductImage
                    imageKey={keys[0]}
                    category={product.category}
                    alt={product.name}
                    className={cn("w-full", frame)}
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
                        <ProductImage
                            key={key}
                            imageKey={key}
                            category={product.category}
                            alt={`${product.name}: ${dotLabel(index + 1)}`}
                            className="h-full w-full shrink-0 snap-center"
                        />
                    ))}
                </div>
                {children}
            </div>
            <div className="flex justify-center">
                {keys.map((key, index) => (
                    <button
                        key={key}
                        type="button"
                        aria-label={dotLabel(index + 1)}
                        aria-current={index === shown}
                        onClick={(): void => go(index)}
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
        </div>
    )
}

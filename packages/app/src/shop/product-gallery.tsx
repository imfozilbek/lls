import { useRef, useState } from "react"

import { fill, useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"
import { ProductImage } from "../ui/product-image.js"

import type { ProductDTO } from "@zumda/core"

function prefersStill(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * The product's photos up close (owner's decision, November 2026: up to three): one photo as
 * before; more, a strip the customer swipes with a dot for each. The strip keeps the page's own
 * sideways swipe («back») off (`data-no-gesture`).
 */
export function ProductGallery({ product }: { product: ProductDTO }): React.JSX.Element | null {
    const t = useT()
    const strip = useRef<HTMLDivElement>(null)
    const [shown, setShown] = useState(0)
    const keys = product.imageKey ? [product.imageKey, ...(product.moreImageKeys ?? [])] : []
    if (keys.length === 0) {
        return null
    }
    if (keys.length === 1) {
        return (
            <ProductImage
                imageKey={keys[0]}
                category={product.category}
                alt={product.name}
                className="aspect-[4/3] w-full rounded-tile"
            />
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
            <div
                ref={strip}
                data-no-gesture
                onScroll={(): void => {
                    const box = strip.current
                    if (box && box.clientWidth > 0) {
                        setShown(Math.round(box.scrollLeft / box.clientWidth))
                    }
                }}
                className="flex snap-x snap-mandatory overflow-x-auto rounded-tile [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {keys.map((key, index) => (
                    <ProductImage
                        key={key}
                        imageKey={key}
                        category={product.category}
                        alt={`${product.name}: ${fill(t.shop.photoOf, { n: index + 1 })}`}
                        className="aspect-[4/3] w-full shrink-0 snap-center"
                    />
                ))}
            </div>
            <div className="flex justify-center">
                {keys.map((key, index) => (
                    <button
                        key={key}
                        type="button"
                        aria-label={fill(t.shop.photoOf, { n: index + 1 })}
                        aria-current={index === shown}
                        onClick={(): void => go(index)}
                        className="tap grid h-11 w-8 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
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

import { useState } from "react"

import { imageUrl } from "../lib/api.js"
import { cn } from "../lib/cn.js"

import { CategoryIcon } from "./icons.js"

/** Photo with a calm brand-tinted placeholder (category drawing) while loading or when missing. */
export function ProductImage({
    imageKey,
    category,
    alt,
    className,
    iconSize = 34,
}: {
    imageKey?: string
    category: string
    alt: string
    className?: string
    iconSize?: number
}): React.JSX.Element {
    const src = imageUrl(imageKey)
    // State is tied to the URL, so a new or removed photo starts from a clean placeholder.
    const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
    const [failedSrc, setFailedSrc] = useState<string | null>(null)
    const loaded = src !== undefined && loadedSrc === src
    const failed = src !== undefined && failedSrc === src
    return (
        <div className={cn("relative overflow-hidden bg-brand/10 text-brand/70", className)}>
            {!loaded ? (
                <div className="absolute inset-0 grid place-items-center">
                    <CategoryIcon category={category} size={iconSize} strokeWidth={1.5} />
                </div>
            ) : null}
            {src && !failed ? (
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    onLoad={(): void => setLoadedSrc(src)}
                    onError={(): void => setFailedSrc(src)}
                    className={cn(
                        "absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out-quart",
                        loaded ? "opacity-100" : "opacity-0",
                    )}
                />
            ) : null}
        </div>
    )
}

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
    const [loaded, setLoaded] = useState(false)
    const [failed, setFailed] = useState(false)
    const src = imageUrl(imageKey)
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
                    onLoad={(): void => setLoaded(true)}
                    onError={(): void => setFailed(true)}
                    className={cn(
                        "absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out-quart",
                        loaded ? "opacity-100" : "opacity-0",
                    )}
                />
            ) : null}
        </div>
    )
}

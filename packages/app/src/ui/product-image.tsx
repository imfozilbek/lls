import { useState } from "react"

import { imageUrl } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { reportMissingImage } from "../lib/crashes.js"

import { CategoryIcon } from "./icons.js"

/** Neighbouring tiles of different sections never look the same. */
const TINTS = ["bg-brand/10", "bg-brand/[0.16]", "bg-brand/[0.06]"] as const

function tintOf(category: string): string {
    let sum = 0
    for (const char of category) {
        sum += char.charCodeAt(0)
    }
    return TINTS[sum % TINTS.length] ?? TINTS[0]
}

/** Photos already on screen once this session: shown again at once, never faded in twice. */
const seen = new Set<string>()

/** Photo with a calm brand-tinted placeholder (category drawing) while loading or when missing. */
export function ProductImage({
    imageKey,
    category,
    alt,
    className,
    iconSize = 34,
    name,
}: {
    imageKey?: string
    category: string
    alt: string
    className?: string
    iconSize?: number
    /** Without a photo, the first letter of the name says what it is at a glance. */
    name?: string
}): React.JSX.Element {
    const src = imageUrl(imageKey)
    // State is tied to the URL, so a new or removed photo starts from a clean placeholder.
    const [loadedSrc, setLoadedSrc] = useState<string | null>(() =>
        src !== undefined && seen.has(src) ? src : null,
    )
    const known = src !== undefined && seen.has(src)
    const [failedSrc, setFailedSrc] = useState<string | null>(null)
    const loaded = src !== undefined && loadedSrc === src
    const failed = src !== undefined && failedSrc === src
    const letter = !src && name ? name.trim().charAt(0).toUpperCase() : ""
    return (
        <div className={cn("relative overflow-hidden text-brand", tintOf(category), className)}>
            {!loaded && letter ? (
                <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
                    <span className="text-5xl font-bold opacity-80">{letter}</span>
                    <CategoryIcon
                        category={category}
                        size={18}
                        strokeWidth={1.75}
                        className="absolute left-3 top-3 opacity-70"
                    />
                </div>
            ) : null}
            {!loaded && !letter ? (
                <div className="absolute inset-0 grid place-items-center text-brand/70">
                    <CategoryIcon category={category} size={iconSize} strokeWidth={1.5} />
                </div>
            ) : null}
            {src && !failed ? (
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    onLoad={(): void => {
                        seen.add(src)
                        setLoadedSrc(src)
                    }}
                    onError={(): void => {
                        setFailedSrc(src)
                        void reportMissingImage(src, "product")
                    }}
                    className={cn(
                        "absolute inset-0 h-full w-full object-cover",
                        !known && "transition-opacity duration-300 ease-out-quart",
                        loaded ? "opacity-100" : "opacity-0",
                    )}
                />
            ) : null}
        </div>
    )
}

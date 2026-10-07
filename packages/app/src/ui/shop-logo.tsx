import { useState } from "react"

import { imageUrl } from "../lib/api.js"
import { readableInk } from "../lib/brand.js"
import { cn } from "../lib/cn.js"
import { reportMissingImage } from "../lib/crashes.js"
import { hexToRgbChannels } from "../lib/format.js"

/**
 * The shop's logo, or its first letter on its color: also when the picture cannot be shown, so a
 * broken image is never on screen (6 October 2026: a logo file went missing). A file that is gone
 * is told to the admins.
 */
export function ShopLogo({
    name,
    logoKey,
    color,
    className,
}: {
    name: string
    logoKey: string | undefined
    /** The shop's color for the letter; without it the page's brand color. */
    color?: string
    /** Size and corners: the same box for the picture and the letter. */
    className: string
}): React.JSX.Element {
    const src = imageUrl(logoKey)
    const [failed, setFailed] = useState<string | null>(null)
    if (src && failed !== src) {
        return (
            <img
                src={src}
                alt=""
                onError={(): void => {
                    setFailed(src)
                    void reportMissingImage(src, "logo")
                }}
                className={cn("shrink-0 object-cover", className)}
            />
        )
    }
    const style = color
        ? { backgroundColor: color, color: `rgb(${readableInk(hexToRgbChannels(color) ?? "")})` }
        : undefined
    return (
        <span
            aria-hidden
            style={style}
            className={cn(
                "grid shrink-0 place-items-center font-bold",
                !color && "bg-brand text-brand-ink",
                className,
            )}
        >
            {name.trim().charAt(0).toUpperCase()}
        </span>
    )
}

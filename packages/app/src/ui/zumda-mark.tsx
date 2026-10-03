import { ZUMDA_MARK } from "../lib/brand.js"
import { cn } from "../lib/cn.js"

/**
 * The Zumda mark: a green pin with a house on mint. Always Zumda's own colors, never the shop's:
 * it signs the small "Zumda asosida ishlaydi" line, the showcase badge and the courier screen.
 */
export function ZumdaMark({
    size = 16,
    className,
}: {
    size?: number
    className?: string
}): React.JSX.Element {
    const { box, door } = ZUMDA_MARK
    return (
        <svg
            viewBox={`0 0 ${box} ${box}`}
            width={size}
            height={size}
            aria-hidden="true"
            className={cn("shrink-0", className)}
        >
            <rect width={box} height={box} rx={box * 0.24} fill={ZUMDA_MARK.mint} />
            <path d={ZUMDA_MARK.pin} fill={ZUMDA_MARK.green} />
            <path
                d={ZUMDA_MARK.roof}
                fill="none"
                stroke={ZUMDA_MARK.white}
                strokeWidth={ZUMDA_MARK.roofWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <rect
                x={door.x}
                y={door.y}
                width={door.width}
                height={door.height}
                rx={door.radius}
                fill={ZUMDA_MARK.white}
            />
        </svg>
    )
}

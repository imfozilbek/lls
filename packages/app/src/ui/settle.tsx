import { useState } from "react"

import { scopedKey } from "../lib/api.js"
import { firstShow } from "../lib/cache.js"
import { cn } from "../lib/cn.js"

import type { ReactNode } from "react"

/**
 * A screen or a tab: its lists rise in the first time it opens this session; opened again, they
 * are simply there (the `settled` class stops the entrance animations inside).
 */
export function Settle({
    id,
    className,
    children,
}: {
    id: string
    className?: string
    children: ReactNode
}): React.JSX.Element {
    const [first] = useState(() => firstShow(scopedKey(id)))
    return <div className={cn(className, !first && "settled")}>{children}</div>
}

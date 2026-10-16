import { REGIONS } from "@zumda/core"

import { useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"

import { regionName } from "./regions.js"

import type { Region } from "@zumda/core"

/** The district's viloyat: the 14 at once, one tap picks (short names, the official order). */
export function RegionField({
    value,
    onChange,
}: {
    value: Region | null
    onChange(region: Region): void
}): React.JSX.Element {
    const p = useT().platform
    return (
        <div className="flex flex-col gap-1.5">
            <p id="district-region" className="px-1 text-sm font-medium text-tg-subtitle">
                {p.region}
            </p>
            <div
                role="radiogroup"
                aria-labelledby="district-region"
                className="flex flex-wrap gap-2"
            >
                {REGIONS.map((region) => (
                    <button
                        key={region}
                        type="button"
                        role="radio"
                        aria-checked={value === region}
                        onClick={(): void => {
                            haptic.select()
                            onChange(region)
                        }}
                        className={cn(
                            "tap h-11 rounded-full px-3.5 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                            value === region ? "bg-brand text-brand-ink" : "bg-tg-secondary",
                        )}
                    >
                        {regionName(p.regionsShort, region)}
                    </button>
                ))}
            </div>
        </div>
    )
}

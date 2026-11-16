import { DeliveryPrice } from "@zumda/core"

import { useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"
import { AlertIcon, BoxIcon, CheckIcon, HeartHomeIcon, ScooterIcon } from "../ui/icons.js"

import type { DeliveryPriceChoice } from "@zumda/core"

const ICONS: Record<DeliveryPriceChoice, typeof BoxIcon> = {
    [DeliveryPrice.FREE]: HeartHomeIcon,
    [DeliveryPrice.FEE]: ScooterIcon,
    [DeliveryPrice.LATER]: BoxIcon,
}

/** A shop whose courier is a dispatcher (a taxi, the post) sees «Narxi keyin aytiladi» first. */
function orderOf(dispatcher: boolean): DeliveryPriceChoice[] {
    return dispatcher
        ? [DeliveryPrice.LATER, DeliveryPrice.FREE, DeliveryPrice.FEE]
        : [DeliveryPrice.FREE, DeliveryPrice.FEE, DeliveryPrice.LATER]
}

/**
 * How the customer pays for delivery (owner's decision, November 2026): «Bepul», «Narxi bor» or
 * «Narxi keyin aytiladi». Until one is picked the customer sees nothing about delivery, and the
 * owner is told so.
 */
export function DeliveryPriceChoices({
    value,
    dispatcher,
    onChange,
}: {
    value: DeliveryPrice
    dispatcher: boolean
    onChange(price: DeliveryPriceChoice): void
}): React.JSX.Element {
    const p = useT().owner.settings.price
    const words: Record<DeliveryPriceChoice, { title: string; hint: string }> = {
        [DeliveryPrice.FREE]: { title: p.free, hint: p.freeHint },
        [DeliveryPrice.FEE]: { title: p.fee, hint: p.feeHint },
        [DeliveryPrice.LATER]: { title: p.later, hint: p.laterHint },
    }
    return (
        <div className="flex flex-col gap-2">
            <p className="px-1 font-semibold">{p.title}</p>
            {value === DeliveryPrice.UNSET ? (
                <p className="flex items-center gap-2 rounded-control bg-warning/10 px-3 py-2 text-sm text-tg-text">
                    <AlertIcon size={18} className="shrink-0 text-warning" />
                    {p.unset}
                </p>
            ) : null}
            <div role="radiogroup" aria-label={p.title} className="flex flex-col gap-2">
                {orderOf(dispatcher).map((price) => {
                    const selected = price === value
                    const Icon = ICONS[price]
                    return (
                        <button
                            key={price}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={(): void => {
                                haptic.select()
                                onChange(price)
                            }}
                            className={cn(
                                "tap flex min-h-[64px] items-center gap-3 rounded-tile p-4 text-left ring-2 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
                                selected
                                    ? "bg-brand/10 ring-brand"
                                    : "bg-tg-secondary ring-transparent",
                            )}
                        >
                            <span className={selected ? "text-brand" : "text-tg-hint"}>
                                <Icon size={24} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold">{words[price].title}</span>
                                <span className="block text-sm text-tg-subtitle">
                                    {words[price].hint}
                                </span>
                                {dispatcher && price === DeliveryPrice.LATER ? (
                                    <span className="mt-1 block text-sm font-medium text-brand">
                                        {p.dispatcher}
                                    </span>
                                ) : null}
                            </span>
                            <span
                                className={cn(
                                    "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200",
                                    selected
                                        ? "border-brand bg-brand text-brand-ink"
                                        : "border-tg-separator",
                                )}
                            >
                                {selected ? <CheckIcon size={14} strokeWidth={3} /> : null}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

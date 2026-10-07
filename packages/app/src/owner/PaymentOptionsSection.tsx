import { PaymentOptions } from "@zumda/core"
import { useState, useEffect } from "react"

import { errorText, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { CardIcon, CashIcon, CheckIcon } from "../ui/icons.js"
import { Section } from "../ui/primitives.js"

import type { ShopOwnerDTO } from "@zumda/core"

const OPTIONS: PaymentOptions[] = [PaymentOptions.CARD, PaymentOptions.CASH, PaymentOptions.BOTH]

function OptionIcon({ option }: { option: PaymentOptions }): React.JSX.Element {
    if (option === PaymentOptions.CASH) {
        return <CashIcon size={22} />
    }
    if (option === PaymentOptions.CARD) {
        return <CardIcon size={22} />
    }
    return (
        <span className="flex -space-x-1.5">
            <CardIcon size={18} />
            <CashIcon size={18} />
        </span>
    )
}

/**
 * «Mijoz qanday to'laydi»: a transfer to the card, cash to the courier, or the customer's choice.
 * Saved at once, like «Buyurtma qabul qilish»: the storefront follows the next time it opens.
 */
export function PaymentOptionsSection({
    shop,
    onSaved,
}: {
    shop: ShopOwnerDTO
    onSaved(shop: ShopOwnerDTO): void
}): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    const [value, setValue] = useState(shop.paymentOptions)
    // A pull to refresh (or a save elsewhere) brings the shop again: the switch follows it.
    useEffect(() => setValue(shop.paymentOptions), [shop.paymentOptions])
    const [saving, setSaving] = useState<PaymentOptions | null>(null)

    const choose = async (next: PaymentOptions): Promise<void> => {
        if (next === value || saving) {
            return
        }
        haptic.select()
        const before = value
        setValue(next)
        setSaving(next)
        try {
            onSaved(await api.owner.updateShop({ paymentOptions: next }))
            haptic.success()
            toast(s.saved, "success")
        } catch (caught) {
            setValue(before)
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setSaving(null)
        }
    }

    return (
        <Section title={s.paymentOptions}>
            <div role="radiogroup" aria-label={s.paymentOptions} className="flex flex-col gap-2">
                {OPTIONS.map((option) => {
                    const selected = option === value
                    const text = s.paymentOption[option]
                    return (
                        <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={(): void => void choose(option)}
                            className={cn(
                                "tap flex min-h-[64px] items-center gap-3 rounded-tile p-4 text-left ring-2 transition-colors duration-200",
                                selected
                                    ? "bg-brand/10 ring-brand"
                                    : "bg-tg-secondary ring-transparent",
                                saving === option && "animate-pulse",
                            )}
                        >
                            <span className={selected ? "text-brand" : "text-tg-hint"}>
                                <OptionIcon option={option} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold">{text.title}</span>
                                <span className="block text-sm text-tg-subtitle">{text.hint}</span>
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
        </Section>
    )
}

import { Feature } from "@zumda/core"
import { useState } from "react"

import { errorText, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { haptic } from "../lib/telegram.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { Button, Field, MoneyInput } from "../ui/primitives.js"

/**
 * A 19 or 20 litre bottle in a shop without the deposit: offered right here, with its sum, in
 * one tap, so a water shop never sells its bottles for nothing by accident.
 */
export function DepositOffer(): React.JSX.Element | null {
    const t = useT()
    const p = t.owner.product
    const shop = useSession((state) => state.shop)
    const [sum, setSum] = useState<number | null>(null)
    const [busy, setBusy] = useState(false)
    if (!shop || shop.features.includes(Feature.BOTTLE_DEPOSIT)) {
        return null
    }
    const turnOn = async (): Promise<void> => {
        setBusy(true)
        try {
            const saved = await api.owner.updateShop({
                features: [...shop.features, Feature.BOTTLE_DEPOSIT],
                bottleDeposit: sum ?? 0,
            })
            const current = useSession.getState().shop
            if (current) {
                useSession.getState().setShop({
                    ...current,
                    features: saved.features,
                    bottleDeposit: saved.bottleDeposit,
                })
            }
            haptic.success()
            toast(p.depositSaved, "success")
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setBusy(false)
        }
    }
    return (
        <div className="flex flex-col gap-3 rounded-tile bg-brand/10 p-4">
            <p className="text-sm font-medium">{p.depositOffer}</p>
            <Field label={t.owner.settings.bottleDeposit} htmlFor="offer-deposit">
                <MoneyInput id="offer-deposit" value={sum} onChange={setSum} />
            </Field>
            <Button
                variant="secondary"
                loading={busy}
                disabled={(sum ?? 0) <= 0}
                onClick={(): void => void turnOn()}
            >
                {p.depositOn}
            </Button>
        </div>
    )
}

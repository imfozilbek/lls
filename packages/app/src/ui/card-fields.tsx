import { PayoutCard, cardSystemOf } from "@zumda/core"

import { fill, useT } from "../i18n/index.js"

import { AlertIcon } from "./icons.js"
import { Field, TextInput } from "./primitives.js"

import type { ReactNode } from "react"

const CARD_DIGITS = 16

/** A full card number that passes the bank check, with a name on it. */
export function payoutCardIsValid(number: string, holder: string): boolean {
    try {
        PayoutCard.create(number, holder)
        return true
    } catch {
        return false
    }
}

/** A full number with a wrong digit: say so right away, not after "Save". */
function cardHasTypo(number: string): boolean {
    return number.length === CARD_DIGITS && !payoutCardIsValid(number, "-")
}

/** A full, valid number whose first digits Zumda does not know: saved after one question. */
export function cardIsUnknown(number: string): boolean {
    return payoutCardIsValid(number, "-") && cardSystemOf(number) === null
}

/**
 * Under the number: a typo first, then the card's system as soon as its first digits tell it,
 * or a warning for a whole valid number of a system Zumda does not know.
 */
function useCardHint(number: string, hint: string): ReactNode {
    const t = useT()
    const s = t.owner.settings
    if (cardHasTypo(number)) {
        return <span className="text-tg-destructive">{s.cardInvalid}</span>
    }
    const system = cardSystemOf(number)
    if (system) {
        return (
            <span className="font-semibold text-tg-text">
                {fill(s.cardSystem, { system: t.pay.cardSystems[system] })}
            </span>
        )
    }
    if (cardIsUnknown(number)) {
        return (
            <span className="flex gap-1.5">
                <AlertIcon size={16} className="mt-0.5 shrink-0 text-warning" />
                {s.cardUnknown}
            </span>
        )
    }
    return hint
}

/**
 * The shop's card for customers' transfers: number (digits only, shown in groups of four) and
 * the name on it. Customers pay only this way, so the card is never optional.
 */
export function PayoutCardFields({
    number,
    holder,
    hint,
    onChange,
}: {
    number: string
    holder: string
    hint: string
    onChange(change: { number?: string; holder?: string }): void
}): React.JSX.Element {
    const s = useT().owner.settings
    const shown = number.replace(/(\d{4})(?=\d)/g, "$1 ")
    const cardHint = useCardHint(number, hint)
    return (
        <>
            <Field label={s.cardNumber} htmlFor="card-number" hint={cardHint}>
                <TextInput
                    id="card-number"
                    inputMode="numeric"
                    autoComplete="off"
                    className="tabular-nums tracking-wide"
                    placeholder="8600 0000 0000 0000"
                    value={shown}
                    onChange={(e): void =>
                        onChange({
                            number: e.target.value.replace(/\D/g, "").slice(0, CARD_DIGITS),
                        })
                    }
                />
            </Field>
            <Field label={s.cardHolder} htmlFor="card-holder">
                <TextInput
                    id="card-holder"
                    autoComplete="off"
                    className="uppercase"
                    maxLength={60}
                    value={holder}
                    onChange={(e): void => onChange({ holder: e.target.value })}
                />
            </Field>
        </>
    )
}

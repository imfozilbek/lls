import { MAX_PAYOUT_CARDS } from "@zumda/core"
import { useEffect, useState } from "react"

import { errorText, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { confirm, haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { PayoutCardFields, payoutCardIsValid } from "../ui/card-fields.js"
import { CardIcon, CheckIcon, PlusIcon, TrashIcon } from "../ui/icons.js"
import { Button, Section, Skeleton } from "../ui/primitives.js"

import type { PayoutCardsDTO, SavedPayoutCardDTO, ShopOwnerDTO } from "@zumda/core"

type Cards = PayoutCardsDTO

function failToast(t: ReturnType<typeof useT>, caught: unknown): void {
    haptic.error()
    toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
}

/** "8600123456789012" → "8600 1234 5678 9012". */
function grouped(number: string): string {
    return number.replace(/(\d{4})(?=\d)/g, "$1 ")
}

/** A new card: the same fields as in onboarding; open at once while the shop has none. */
function AddCard({
    open,
    onOpen,
    onAdded,
}: {
    open: boolean
    onOpen(open: boolean): void
    onAdded(cards: Cards): void
}): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    const [draft, setDraft] = useState({ number: "", holder: "" })
    const [saving, setSaving] = useState(false)
    const valid = payoutCardIsValid(draft.number, draft.holder)
    const save = async (): Promise<void> => {
        setSaving(true)
        try {
            onAdded(await api.owner.addCard({ number: draft.number, holder: draft.holder.trim() }))
            setDraft({ number: "", holder: "" })
            onOpen(false)
            haptic.success()
            toast(s.cardAdded, "success")
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setSaving(false)
        }
    }
    if (!open) {
        return (
            <Button
                variant="surface"
                icon={<PlusIcon size={18} />}
                onClick={(): void => {
                    haptic.tap()
                    onOpen(true)
                }}
            >
                {s.addCard}
            </Button>
        )
    }
    return (
        <div className="flex animate-rise flex-col gap-3 rounded-tile bg-tg-secondary p-4">
            <PayoutCardFields
                number={draft.number}
                holder={draft.holder}
                hint={s.cardHint}
                onChange={(change): void => setDraft((d) => ({ ...d, ...change }))}
            />
            <div className="flex gap-2">
                <Button
                    className="grow"
                    loading={saving}
                    disabled={!valid}
                    onClick={(): void => void save()}
                >
                    {s.saveCard}
                </Button>
                <Button variant="surface" onClick={(): void => onOpen(false)}>
                    {t.common.cancel}
                </Button>
            </div>
        </div>
    )
}

function CardRow({
    card,
    isPayment,
    busy,
    onChoose,
    onRemove,
}: {
    card: SavedPayoutCardDTO
    isPayment: boolean
    busy: boolean
    onChoose(): void
    onRemove(): void
}): React.JSX.Element {
    const s = useT().owner.settings
    return (
        <li
            className={cn(
                "flex animate-rise flex-col gap-3 rounded-tile p-4 ring-2 transition-colors duration-200",
                isPayment ? "bg-brand/10 ring-brand" : "bg-tg-secondary ring-transparent",
            )}
        >
            <div className="flex items-start gap-3">
                <span className={isPayment ? "text-brand" : "text-tg-hint"}>
                    <CardIcon size={24} />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block font-semibold tabular-nums tracking-wide">
                        {grouped(card.number)}
                    </span>
                    <span className="block truncate text-sm uppercase text-tg-subtitle">
                        {card.holder}
                    </span>
                </span>
                {isPayment ? (
                    <span className="flex shrink-0 animate-pop items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-brand-ink">
                        <CheckIcon size={14} />
                        {s.paymentCard}
                    </span>
                ) : (
                    <button
                        type="button"
                        aria-label={s.removeCard}
                        onClick={onRemove}
                        className="tap -m-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-tg-hint transition-colors hover:text-tg-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand active:text-tg-destructive"
                    >
                        <TrashIcon size={18} />
                    </button>
                )}
            </div>
            {isPayment ? null : (
                <Button variant="surface" loading={busy} onClick={onChoose}>
                    {s.useForPayment}
                </Button>
            )}
        </li>
    )
}

/**
 * «Kartalar»: the shop keeps as many cards as it needs; customers are shown only the payment
 * card, and the owner switches it at any moment. The payment card itself is never removed.
 */
export function PaymentCardsSection({
    onSaved,
}: {
    onSaved(shop: ShopOwnerDTO): void
}): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    const [cards, setCards] = useState<Cards | null>(null)
    const [adding, setAdding] = useState(false)
    const [busy, setBusy] = useState<string | null>(null)

    useEffect(() => {
        api.owner
            .cards()
            .then((loaded) => {
                setCards(loaded)
                setAdding(loaded.cards.length === 0)
            })
            .catch((caught: unknown) => failToast(t, caught))
    }, [t])

    /** The storefront shows the payment card: keep "Мой магазин" and it in sync. */
    const changed = async (next: Cards): Promise<void> => {
        setCards(next)
        // The card is saved already: a failed refresh of the shop must not read as a failure.
        await api.owner
            .shop()
            .then(onSaved)
            .catch(() => undefined)
    }

    const choose = async (id: string): Promise<void> => {
        setBusy(id)
        try {
            await changed(await api.owner.choosePaymentCard(id))
            haptic.success()
            toast(s.paymentCardChosen, "success")
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setBusy(null)
        }
    }

    const remove = async (id: string): Promise<void> => {
        if (!(await confirm(s.removeCardConfirm))) {
            return
        }
        try {
            await api.owner.removeCard(id)
            setCards((c) => c && { ...c, cards: c.cards.filter((card) => card.id !== id) })
            haptic.success()
        } catch (caught) {
            failToast(t, caught)
        }
    }

    if (!cards) {
        return (
            <Section>
                <Skeleton className="h-24 rounded-tile" />
            </Section>
        )
    }
    return (
        <Section>
            {cards.cards.length > 0 ? (
                <ul className="flex flex-col gap-2">
                    {cards.cards.map((card) => (
                        <CardRow
                            key={card.id}
                            card={card}
                            isPayment={card.id === cards.paymentCardId}
                            busy={busy === card.id}
                            onChoose={(): void => void choose(card.id)}
                            onRemove={(): void => void remove(card.id)}
                        />
                    ))}
                </ul>
            ) : null}
            {cards.cards.length < MAX_PAYOUT_CARDS ? (
                <AddCard
                    open={adding}
                    onOpen={setAdding}
                    onAdded={(next): void => void changed(next)}
                />
            ) : null}
            {cards.cards.length > 0 ? (
                <p className="px-1 text-sm text-tg-hint">{s.cardHint}</p>
            ) : null}
        </Section>
    )
}

import { BUSINESS_TYPES, BusinessType } from "@zumda/core"
import { useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { updateBotPhoto } from "../lib/bot-photo.js"
import { cn } from "../lib/cn.js"
import { useBackButton, useMainAction } from "../lib/main-button.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { PayoutCardFields, payoutCardIsValid } from "../ui/card-fields.js"
import { CheckIcon } from "../ui/icons.js"
import { EmptyState, Field, MoneyInput, TextInput } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import { BotStep, TOKEN_PATTERN, useManagedBot } from "./BotStep.js"

import type { BotMode, ManagedBotFlow } from "./BotStep.js"
import type { Dictionary } from "../i18n/index.js"
import type { ManagedBot, RegisterShopBot } from "../lib/api.js"
import type { ShopOwnerDTO } from "@zumda/core"

type ShopType = BusinessType
type Step = 1 | 2 | 3

interface Draft {
    /** `create`: Zumda creates the bot (no token); `token`: a BotFather bot the owner has. */
    botMode: BotMode
    botToken: string
    managedBot: ManagedBot | null
    name: string
    type: ShopType
    address: string
    fee: number | null
    freeFrom: number | null
    minOrder: number | null
    /** Customers pay only by transfer to this card: a required step. */
    cardNumber: string
    cardHolder: string
}

const EMPTY: Draft = {
    botMode: "create",
    botToken: "",
    managedBot: null,
    name: "",
    type: BusinessType.FOOD,
    address: "",
    fee: null,
    freeFrom: null,
    minOrder: null,
    cardNumber: "",
    cardHolder: "",
}

function hasBot(draft: Draft): boolean {
    return draft.botMode === "token"
        ? TOKEN_PATTERN.test(draft.botToken.trim())
        : draft.managedBot !== null
}

function canContinue(step: Step, draft: Draft): boolean {
    if (step === 1) {
        return draft.name.trim().length > 0
    }
    if (step === 2) {
        return hasBot(draft)
    }
    return draft.fee !== null && payoutCardIsValid(draft.cardNumber, draft.cardHolder)
}

function Progress({ step }: { step: Step }): React.JSX.Element {
    return (
        <div className="flex gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((n) => (
                <span
                    key={n}
                    className={cn(
                        "h-1.5 flex-1 rounded-full transition-colors duration-300",
                        n <= step ? "bg-brand" : "bg-tg-secondary",
                    )}
                />
            ))}
        </div>
    )
}

function ShopStep({
    draft,
    patch,
}: {
    draft: Draft
    patch(change: Partial<Draft>): void
}): React.JSX.Element {
    const t = useT().onboarding
    return (
        <>
            <h1 className="text-2xl font-bold">{t.shopTitle}</h1>
            <Field label={t.name} htmlFor="shop-name">
                <TextInput
                    id="shop-name"
                    value={draft.name}
                    maxLength={60}
                    placeholder={t.namePlaceholder}
                    onChange={(e): void => patch({ name: e.target.value })}
                />
            </Field>
            <Field label={t.type}>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.type}>
                    {BUSINESS_TYPES.map((type) => (
                        <button
                            key={type}
                            type="button"
                            role="radio"
                            aria-checked={draft.type === type}
                            onClick={(): void => {
                                haptic.select()
                                patch({ type })
                            }}
                            className={cn(
                                "tap h-12 rounded-control font-semibold transition-colors duration-200",
                                draft.type === type ? "bg-brand text-brand-ink" : "bg-tg-secondary",
                            )}
                        >
                            {t.types[type]}
                        </button>
                    ))}
                </div>
            </Field>
            <Field label={`${t.address} (${t.optional})`} htmlFor="shop-address">
                <TextInput
                    id="shop-address"
                    value={draft.address}
                    maxLength={200}
                    onChange={(e): void => patch({ address: e.target.value })}
                />
            </Field>
        </>
    )
}

function DeliveryStep({
    draft,
    patch,
}: {
    draft: Draft
    patch(change: Partial<Draft>): void
}): React.JSX.Element {
    const t = useT().onboarding
    return (
        <>
            <h1 className="text-2xl font-bold">{t.deliveryTitle}</h1>
            <Field label={t.fee} htmlFor="fee">
                <MoneyInput id="fee" value={draft.fee} onChange={(fee): void => patch({ fee })} />
            </Field>
            <Field label={`${t.freeFrom} (${t.optional})`} htmlFor="free-from">
                <MoneyInput
                    id="free-from"
                    value={draft.freeFrom}
                    onChange={(freeFrom): void => patch({ freeFrom })}
                />
            </Field>
            <Field label={`${t.minOrder} (${t.optional})`} htmlFor="min-order">
                <MoneyInput
                    id="min-order"
                    value={draft.minOrder}
                    onChange={(minOrder): void => patch({ minOrder })}
                />
            </Field>
            <h2 className="pt-2 text-xl font-bold">{t.cardTitle}</h2>
            <PayoutCardFields
                number={draft.cardNumber}
                holder={draft.cardHolder}
                hint={t.cardHint}
                onChange={(change): void =>
                    patch({
                        ...(change.number === undefined ? {} : { cardNumber: change.number }),
                        ...(change.holder === undefined ? {} : { cardHolder: change.holder }),
                    })
                }
            />
        </>
    )
}

/** Success screen. Its "Done" button is declared by <Wizard/>: one screen, one main action. */
function Sent(): React.JSX.Element {
    const t = useT()
    return (
        <EmptyState
            art={<CheckIcon size={44} strokeWidth={2.25} />}
            title={t.onboarding.sentTitle}
            text={t.onboarding.sentText}
        />
    )
}

/** A bot problem sends the owner back to step «Bot». */
function stepAfterError(code: string): Step | null {
    return ["INVALID_BOT_TOKEN", "CONFLICT", "ENTITY_NOT_FOUND"].includes(code) ? 2 : null
}

function chosenBot(draft: Draft): RegisterShopBot {
    return draft.botMode === "create" && draft.managedBot
        ? { managedBotId: draft.managedBot.botId }
        : { botToken: draft.botToken.trim() }
}

async function submit(draft: Draft): Promise<ShopOwnerDTO> {
    return api.platform.register({
        ...chosenBot(draft),
        name: draft.name.trim(),
        type: draft.type,
        address: draft.address.trim() || undefined,
        deliveryFee: draft.fee ?? 0,
        freeDeliveryFrom: draft.freeFrom ?? undefined,
        minOrder: draft.minOrder ?? undefined,
        payoutCard: { number: draft.cardNumber, holder: draft.cardHolder.trim() },
    })
}

function actionText(t: Dictionary, step: Step, sending: boolean): string {
    if (step < 3) {
        return t.common.next
    }
    return sending ? t.onboarding.submitting : t.onboarding.submit
}

/** Step «Bot» without a bot yet: the main button creates it. */
function needsBotCreation(step: Step, draft: Draft): boolean {
    return step === 2 && draft.botMode === "create" && draft.managedBot === null
}

function createAction(
    t: Dictionary,
    flow: ManagedBotFlow,
): { text: string; onClick(): void; loading: boolean } {
    return {
        text: t.onboarding.botCreate,
        onClick: (): void => void flow.create(),
        loading: flow.phase === "opening" || flow.phase === "waiting",
    }
}

/** Three short steps: business → bot → delivery and the card. The platform admin approves it. */
export function Wizard({
    onDone,
    onCancel,
}: {
    onDone(): void
    onCancel(): void
}): React.JSX.Element {
    const t = useT()
    const [step, setStep] = useState<Step>(1)
    const [draft, setDraft] = useState<Draft>(EMPTY)
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const patch = (change: Partial<Draft>): void => setDraft((d) => ({ ...d, ...change }))
    const flow = useManagedBot(draft.name, (managedBot) => patch({ managedBot }))

    const next = async (): Promise<void> => {
        if (step < 3) {
            haptic.tap()
            setStep((step + 1) as Step)
            window.scrollTo({ top: 0 })
            return
        }
        setSending(true)
        try {
            const shop = await submit(draft)
            haptic.success()
            setSent(true)
            // The new bot gets Zumda's picture at once: the shop's name and the Zumda mark.
            void updateBotPhoto(
                { shopName: shop.name, brandColor: shop.brandColor, logo: null },
                (jpeg) => api.platform.setBotPhoto(shop.id, jpeg),
            ).then((code) => code && toast(errorText(t, code), "error"))
        } catch (caught) {
            haptic.error()
            const code = caught instanceof ApiError ? caught.code : "generic"
            toast(errorText(t, code), "error")
            const back = stepAfterError(code)
            if (back) {
                // The managed bot was taken or is gone: choose the bot again.
                patch({ managedBot: null })
                setStep(back)
            }
        } finally {
            setSending(false)
        }
    }

    useBackButton(
        sent || sending ? null : (): void => (step > 1 ? setStep((step - 1) as Step) : onCancel()),
    )

    useMainAction(
        sent
            ? { text: t.common.done, onClick: onDone }
            : needsBotCreation(step, draft)
              ? createAction(t, flow)
              : {
                    text: actionText(t, step, sending),
                    onClick: (): void => void next(),
                    loading: sending,
                    disabled: !canContinue(step, draft),
                },
    )

    if (sent) {
        return <Sent />
    }
    return (
        <main className="flex flex-col gap-5 px-4 pt-4">
            <Progress step={step} />
            <p className="text-sm font-medium text-tg-hint">
                {fill(t.onboarding.step, { n: step })}
            </p>
            <div key={step} className="flex animate-rise flex-col gap-5">
                {step === 1 ? <ShopStep draft={draft} patch={patch} /> : null}
                {step === 2 ? (
                    <BotStep
                        name={draft.name}
                        mode={draft.botMode}
                        token={draft.botToken}
                        flow={flow}
                        onMode={(botMode): void => patch({ botMode })}
                        onToken={(botToken): void => patch({ botToken })}
                    />
                ) : null}
                {step === 3 ? <DeliveryStep draft={draft} patch={patch} /> : null}
            </div>
            <BottomSpacer />
        </main>
    )
}

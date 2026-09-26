import { BUSINESS_TYPES, BusinessType } from "@lls/core"
import { useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { useBackButton, useMainAction } from "../lib/main-button.js"
import { haptic, openTelegramLink } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { BotIcon, CheckIcon } from "../ui/icons.js"
import { Button, EmptyState, Field, MoneyInput, TextInput } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import type { Dictionary } from "../i18n/index.js"

/** Same shape the Worker accepts; checked here so the owner sees the mistake at once. */
const TOKEN_PATTERN = /^\d{5,15}:[A-Za-z0-9_-]{30,64}$/
type ShopType = BusinessType
type Step = 1 | 2 | 3

interface Draft {
    botToken: string
    name: string
    type: ShopType
    address: string
    fee: number | null
    freeFrom: number | null
    minOrder: number | null
}

const EMPTY: Draft = {
    botToken: "",
    name: "",
    type: BusinessType.FOOD,
    address: "",
    fee: null,
    freeFrom: null,
    minOrder: null,
}

function canContinue(step: Step, draft: Draft): boolean {
    if (step === 1) {
        return TOKEN_PATTERN.test(draft.botToken.trim())
    }
    if (step === 2) {
        return draft.name.trim().length > 0
    }
    return draft.fee !== null
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

function BotStep({
    draft,
    patch,
}: {
    draft: Draft
    patch(change: Partial<Draft>): void
}): React.JSX.Element {
    const t = useT().onboarding
    return (
        <>
            <h1 className="text-2xl font-bold">{t.botTitle}</h1>
            <ol className="flex flex-col gap-3">
                {t.botSteps.map((text, index) => (
                    <li key={text} className="flex gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/15 text-sm font-bold">
                            {index + 1}
                        </span>
                        <span className="pt-0.5">{text}</span>
                    </li>
                ))}
            </ol>
            <Button
                variant="secondary"
                icon={<BotIcon size={20} className="text-brand" />}
                onClick={(): void => openTelegramLink("https://t.me/BotFather")}
            >
                {t.openBotFather}
            </Button>
            <Field label={t.token} htmlFor="bot-token">
                <TextInput
                    id="bot-token"
                    value={draft.botToken}
                    placeholder={t.tokenPlaceholder}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="font-mono text-sm"
                    onChange={(e): void => patch({ botToken: e.target.value.trim() })}
                />
            </Field>
        </>
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

function stepAfterError(code: string): Step | null {
    return code === "INVALID_BOT_TOKEN" || code === "CONFLICT" ? 1 : null
}

async function submit(draft: Draft): Promise<void> {
    await api.platform.register({
        botToken: draft.botToken.trim(),
        name: draft.name.trim(),
        type: draft.type,
        address: draft.address.trim() || undefined,
        deliveryFee: draft.fee ?? 0,
        freeDeliveryFrom: draft.freeFrom ?? undefined,
        minOrder: draft.minOrder ?? undefined,
    })
}

function actionText(t: Dictionary, step: Step, sending: boolean): string {
    if (step < 3) {
        return t.common.next
    }
    return sending ? t.onboarding.submitting : t.onboarding.submit
}

/** Three short steps: bot → shop → delivery. The platform admin approves the result. */
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

    const next = async (): Promise<void> => {
        if (step < 3) {
            haptic.tap()
            setStep((step + 1) as Step)
            window.scrollTo({ top: 0 })
            return
        }
        setSending(true)
        try {
            await submit(draft)
            haptic.success()
            setSent(true)
        } catch (caught) {
            haptic.error()
            const code = caught instanceof ApiError ? caught.code : "generic"
            toast(errorText(t, code), "error")
            setStep(stepAfterError(code) ?? step)
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
                {step === 1 ? <BotStep draft={draft} patch={patch} /> : null}
                {step === 2 ? <ShopStep draft={draft} patch={patch} /> : null}
                {step === 3 ? <DeliveryStep draft={draft} patch={patch} /> : null}
            </div>
            <BottomSpacer />
        </main>
    )
}

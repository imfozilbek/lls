import { BUSINESS_TYPES, BusinessType } from "@zumda/core"
import { useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { updateBotPhoto } from "../lib/bot-photo.js"
import { cn } from "../lib/cn.js"
import { useBackButton, useClosingGuard, useMainAction } from "../lib/main-button.js"
import { getLocation, haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { CheckIcon, DishIcon, PinIcon, ShopFrontIcon, ToolIcon } from "../ui/icons.js"
import { Button, Field, TextInput } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import { BotStep, TOKEN_PATTERN, useManagedBot } from "./BotStep.js"

import type { BotMode, ManagedBotFlow } from "./BotStep.js"
import type { Dictionary } from "../i18n/index.js"
import type { ManagedBot, RegisterShopBot } from "../lib/api.js"
import type { ShopOwnerDTO } from "@zumda/core"

type ShopType = BusinessType

/** One picture per kind of business in the type choice. */
const KIND_ICONS: Record<BusinessType, React.JSX.Element> = {
    [BusinessType.GROCERY]: <ShopFrontIcon size={20} />,
    [BusinessType.FOOD]: <DishIcon size={20} />,
    [BusinessType.SERVICE]: <ToolIcon size={20} />,
}
type Step = 1 | 2 | 3

interface Draft {
    /** `create`: Zumda creates the bot (no token); `token`: a BotFather bot the owner has. */
    botMode: BotMode
    botToken: string
    managedBot: ManagedBot | null
    name: string
    /** Nothing is picked for the owner: a wrong kind changes every word the customers read. */
    type: ShopType | null
    address: string
    /** Where the business is: its district and the network's couriers come from this. */
    location: { latitude: number; longitude: number } | null
}

const EMPTY: Draft = {
    botMode: "create",
    botToken: "",
    managedBot: null,
    name: "",
    type: null,
    address: "",
    location: null,
}

function hasBot(draft: Draft): boolean {
    return draft.botMode === "token"
        ? TOKEN_PATTERN.test(draft.botToken.trim())
        : draft.managedBot !== null
}

/** What the step still needs, in the order the owner fills it in. */
function missingText(t: Dictionary, step: Step, draft: Draft): string {
    if (step === 2) {
        return t.onboarding.needBot
    }
    return draft.name.trim().length === 0 ? t.onboarding.needName : t.onboarding.needType
}

function canContinue(step: Step, draft: Draft): boolean {
    if (step === 1) {
        return draft.name.trim().length > 0 && draft.type !== null
    }
    if (step === 2) {
        return hasBot(draft)
    }
    // «Joylashuv» may wait: «Ishga tayyor» asks for it again.
    return true
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
                <div className="flex flex-col gap-2" role="radiogroup" aria-label={t.type}>
                    {BUSINESS_TYPES.map((type) => {
                        const picked = draft.type === type
                        return (
                            <button
                                key={type}
                                type="button"
                                role="radio"
                                aria-checked={picked}
                                onClick={(): void => {
                                    haptic.select()
                                    patch({ type })
                                }}
                                className={cn(
                                    "tap flex h-14 items-center gap-3 rounded-control px-3 text-left font-semibold transition-colors duration-200",
                                    picked ? "bg-brand text-brand-ink" : "bg-tg-secondary",
                                )}
                            >
                                <span
                                    className={cn(
                                        "grid h-9 w-9 place-items-center rounded-full transition-colors duration-200",
                                        picked ? "bg-brand-ink/15" : "bg-brand/10 text-brand",
                                    )}
                                >
                                    {KIND_ICONS[type]}
                                </span>
                                <span className="flex-1">{t.types[type]}</span>
                                {picked ? (
                                    <CheckIcon
                                        size={20}
                                        strokeWidth={2.5}
                                        className="animate-pop"
                                    />
                                ) : null}
                            </button>
                        )
                    })}
                </div>
            </Field>
        </>
    )
}

function LocationStep({
    draft,
    patch,
}: {
    draft: Draft
    patch(change: Partial<Draft>): void
}): React.JSX.Element {
    const t = useT()
    const o = t.onboarding
    const [busy, setBusy] = useState(false)
    const locate = async (): Promise<void> => {
        setBusy(true)
        const found = await getLocation()
        setBusy(false)
        if (!found) {
            haptic.error()
            toast(t.checkout.locationFailed, "error")
            return
        }
        haptic.success()
        patch({ location: { latitude: found.latitude, longitude: found.longitude } })
    }
    return (
        <>
            <h1 className="text-2xl font-bold">{o.locationTitle}</h1>
            <p className="text-tg-subtitle">{o.locationText}</p>
            {draft.location ? (
                <div className="flex animate-pop items-center gap-3 rounded-tile bg-success/15 p-4">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-tg-bg text-success">
                        <CheckIcon size={22} strokeWidth={2.5} />
                    </span>
                    <span className="flex-1 font-semibold">{o.locationTaken}</span>
                    <button
                        type="button"
                        onClick={(): void => void locate()}
                        className="tap rounded-full px-3 py-2 text-sm font-semibold text-tg-subtitle focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    >
                        {o.locationAgain}
                    </button>
                </div>
            ) : (
                <Button
                    variant="secondary"
                    size="lg"
                    loading={busy}
                    icon={<PinIcon size={20} className="text-brand" />}
                    onClick={(): void => void locate()}
                >
                    {o.locationSend}
                </Button>
            )}
            <Field label={`${o.address} (${o.optional})`} htmlFor="shop-address">
                <TextInput
                    id="shop-address"
                    value={draft.address}
                    maxLength={200}
                    placeholder={o.addressPlaceholder}
                    onChange={(e): void => patch({ address: e.target.value })}
                />
            </Field>
            {draft.location ? null : <p className="px-1 text-sm text-tg-hint">{o.locationLater}</p>}
        </>
    )
}

/** A bot problem sends the owner back to step «Bot». */
function stepAfterError(code: string): Step | null {
    return ["INVALID_BOT_TOKEN", "BOT_TAKEN", "ENTITY_NOT_FOUND"].includes(code) ? 2 : null
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
        // Step 1 does not let the owner on without a kind.
        type: draft.type ?? BusinessType.GROCERY,
        address: draft.address.trim() || undefined,
        location: draft.location ?? undefined,
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

/**
 * Three short steps: the business, its bot, where it is. The rest (the card, the fee, hours,
 * products) waits in «Ishga tayyor», right in the owner section the wizard opens.
 */
export function Wizard({
    onDone,
    onCancel,
}: {
    /** The application went out: open the new business. */
    onDone(shop: ShopOwnerDTO): void
    onCancel(): void
}): React.JSX.Element {
    const t = useT()
    const [step, setStep] = useState<Step>(1)
    const [draft, setDraft] = useState<Draft>(EMPTY)
    const [sending, setSending] = useState(false)
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
            // The new bot gets Zumda's picture at once: the shop's name and the Zumda mark.
            // Before opening the shop: from then on requests carry the shop, not the platform.
            const photoError = await updateBotPhoto(
                { shopName: shop.name, brandColor: shop.brandColor, logo: null },
                (jpeg) => api.platform.setBotPhoto(shop.id, jpeg),
            )
            haptic.success()
            toast(
                photoError ? errorText(t, photoError) : t.onboarding.sentTitle,
                photoError ? "error" : "success",
            )
            onDone(shop)
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
        sending ? null : (): void => (step > 1 ? setStep((step - 1) as Step) : onCancel()),
    )
    // Halfway through the application: closing the app by mistake asks first.
    useClosingGuard(step > 1 || draft.name.trim().length > 0)

    useMainAction(
        needsBotCreation(step, draft)
            ? createAction(t, flow)
            : {
                  text: actionText(t, step, sending),
                  // Never a dead button: a tap says what the step still needs.
                  onClick: (): void => {
                      if (canContinue(step, draft)) {
                          void next()
                          return
                      }
                      haptic.error()
                      toast(missingText(t, step, draft), "error")
                  },
                  loading: sending,
              },
    )

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
                {step === 3 ? <LocationStep draft={draft} patch={patch} /> : null}
            </div>
            <BottomSpacer />
        </main>
    )
}

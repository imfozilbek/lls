import { FEATURES, Feature } from "@zumda/core"
import { useEffect, useRef, useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, api, imageUrl } from "../lib/api.js"
import { updateBotPhoto } from "../lib/bot-photo.js"
import { BRAND_SWATCHES, applyBrand, readableInk } from "../lib/brand.js"
import { cn } from "../lib/cn.js"
import { hexToRgbChannels } from "../lib/format.js"
import { compressImage } from "../lib/image.js"
import { useMainAction } from "../lib/main-button.js"
import { getLocation, haptic } from "../lib/telegram.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { AlertIcon, CheckIcon, CopyIcon, PinIcon, WifiOffIcon } from "../ui/icons.js"
import {
    Button,
    EmptyState,
    Field,
    MoneyInput,
    Section,
    Skeleton,
    Switch,
    TextInput,
} from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import { CouriersSection, NetworkSection } from "./CouriersSection.js"
import { HoursEditor } from "./HoursEditor.js"
import { PaymentCardsSection } from "./PaymentCardsSection.js"
import { PosterSection } from "./PosterSection.js"
import { hasOpenDay, hoursOf, scheduleOf } from "./hours.js"
import { useOwner } from "./store.js"

import type { Hours } from "./hours.js"
import type { ReadySection } from "./store.js"
import type { ShopPatch } from "../lib/api.js"
import type { BotAvatarInput } from "../lib/bot-avatar.js"
import type { ShopOwnerDTO } from "@zumda/core"

interface Form {
    name: string
    brandColor: string
    address: string
    location: { latitude: number; longitude: number } | null
    fee: number | null
    freeFrom: number | null
    minOrder: number | null
    /** Delivery radius in whole km; empty = no limit. */
    radiusKm: number | null
    hours: Hours
    features: Feature[]
    bottleDeposit: number | null
}

const METERS_PER_KM = 1000
const BPS_PER_PERCENT = 100
const MAX_RADIUS_KM = 100

function formOf(shop: ShopOwnerDTO): Form {
    return {
        name: shop.name,
        brandColor: shop.brandColor,
        address: shop.address ?? "",
        location: shop.location ?? null,
        fee: shop.delivery.fee,
        freeFrom: shop.delivery.freeFrom ?? null,
        minOrder: shop.delivery.minOrder ?? null,
        radiusKm: shop.deliveryRadiusMeters
            ? Math.round(shop.deliveryRadiusMeters / METERS_PER_KM)
            : null,
        hours: hoursOf(shop.workingHours),
        features: [...shop.features],
        bottleDeposit: shop.bottleDeposit || null,
    }
}

function patchOf(form: Form): ShopPatch {
    return {
        name: form.name.trim(),
        brandColor: form.brandColor,
        address: form.address.trim() || null,
        location: form.location,
        delivery: {
            fee: form.fee ?? 0,
            freeFrom: form.freeFrom,
            minOrder: form.minOrder,
            radiusMeters: form.radiusKm ? form.radiusKm * METERS_PER_KM : null,
        },
        workingHours: scheduleOf(form.hours),
        // Canonical order, so ticking a box off and on again leaves the form clean.
        features: FEATURES.filter((f) => form.features.includes(f)),
        bottleDeposit: form.bottleDeposit ?? 0,
    }
}

/** Keeps the storefront (and the brand color) in sync with what the owner just saved. */
export function sectionId(section: ReadySection | "delivery"): string {
    return `ready-${section}`
}

function publish(shop: ShopOwnerDTO): void {
    applyBrand(shop.brandColor)
    useSession.getState().setShop({ ...shop, viewerRole: "owner" })
}

function useOwnerShop(): {
    shop: ShopOwnerDTO | null
    error: string | null
    reload(): Promise<void>
    setShop(shop: ShopOwnerDTO): void
} {
    const [shop, setShopState] = useState<ShopOwnerDTO | null>(null)
    const [error, setError] = useState<string | null>(null)
    const reload = async (): Promise<void> => {
        setError(null)
        try {
            setShopState(await api.owner.shop())
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "generic")
        }
    }
    useEffect(() => {
        void reload()
    }, [])
    const setShop = (next: ShopOwnerDTO): void => {
        setShopState(next)
        publish(next)
    }
    return { shop, error, reload, setShop }
}

function failToast(t: ReturnType<typeof useT>, caught: unknown): void {
    haptic.error()
    toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
}

function AcceptingCard({
    shop,
    onSaved,
}: {
    shop: ShopOwnerDTO
    onSaved(shop: ShopOwnerDTO): void
}): React.JSX.Element {
    const t = useT()
    const [value, setValue] = useState(shop.acceptingOrders)
    const change = async (next: boolean): Promise<void> => {
        setValue(next)
        try {
            onSaved(await api.owner.updateShop({ acceptingOrders: next }))
        } catch (caught) {
            setValue(!next)
            failToast(t, caught)
        }
    }
    return (
        <div
            className={cn(
                "flex items-center gap-3 rounded-tile p-4 transition-colors duration-300",
                value ? "bg-success/15" : "bg-warning/15",
            )}
        >
            <div className="flex-1">
                <p className="flex items-center gap-2 font-semibold">
                    {value ? null : <AlertIcon size={18} className="shrink-0 text-warning" />}
                    {t.owner.settings.accepting}
                </p>
                <p className="text-sm text-tg-subtitle">
                    {value ? t.owner.settings.acceptingHint : t.owner.settings.acceptingOff}
                </p>
            </div>
            <Switch
                checked={value}
                onChange={(next): void => void change(next)}
                label={t.owner.settings.accepting}
            />
        </div>
    )
}

/** Zumda's picture on the shop bot; a refusal is only a toast, the shop is already saved. */
async function syncBotPhoto(t: ReturnType<typeof useT>, input: BotAvatarInput): Promise<void> {
    const code = await updateBotPhoto(input, api.owner.setBotPhoto)
    if (code) {
        toast(errorText(t, code), "error")
    }
}
function LogoPicker({
    shop,
    onSaved,
}: {
    shop: ShopOwnerDTO
    onSaved(shop: ShopOwnerDTO): void
}): React.JSX.Element {
    const t = useT()
    const input = useRef<HTMLInputElement>(null)
    const [busy, setBusy] = useState(false)
    const logo = imageUrl(shop.logoKey)

    const pick = async (file: File | undefined): Promise<void> => {
        if (!file) {
            return
        }
        setBusy(true)
        try {
            const logo = await compressImage(file, 512)
            const saved = await api.owner.uploadLogo(logo)
            onSaved(saved)
            haptic.success()
            void syncBotPhoto(t, { shopName: saved.name, brandColor: saved.brandColor, logo })
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="flex items-center gap-4">
            {logo ? (
                <img src={logo} alt="" className="h-16 w-16 rounded-[1.25rem] object-cover" />
            ) : (
                <span className="grid h-16 w-16 place-items-center rounded-[1.25rem] bg-brand text-2xl font-bold text-brand-ink">
                    {shop.name.trim().charAt(0).toUpperCase()}
                </span>
            )}
            <Button variant="secondary" loading={busy} onClick={(): void => input.current?.click()}>
                {t.owner.settings.logo}
            </Button>
            <input
                ref={input}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event): void => {
                    void pick(event.target.files?.[0])
                    event.target.value = ""
                }}
            />
        </div>
    )
}

function ColorPicker({
    value,
    onChange,
}: {
    value: string
    onChange(color: string): void
}): React.JSX.Element {
    const t = useT()
    return (
        <div
            className="grid grid-cols-7 justify-items-center gap-1"
            role="radiogroup"
            aria-label={t.owner.settings.color}
        >
            {BRAND_SWATCHES.map((color) => {
                const selected = color.toLowerCase() === value.toLowerCase()
                return (
                    <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={color}
                        onClick={(): void => {
                            haptic.select()
                            onChange(color)
                        }}
                        style={{
                            backgroundColor: color,
                            color: `rgb(${readableInk(hexToRgbChannels(color) ?? "")})`,
                        }}
                        className={cn(
                            "tap grid h-11 w-11 place-items-center rounded-full transition-shadow duration-200",
                            selected && "ring-4 ring-tg-text/15",
                        )}
                    >
                        {selected ? <CheckIcon size={20} strokeWidth={2.5} /> : null}
                    </button>
                )
            })}
        </div>
    )
}

function ShopLink({ shop }: { shop: ShopOwnerDTO }): React.JSX.Element {
    const t = useT()
    const [copied, setCopied] = useState(false)
    const link = `https://t.me/${shop.botUsername}`
    const copy = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(link)
            haptic.success()
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
        } catch {
            toast(link)
        }
    }
    return (
        <button
            type="button"
            onClick={(): void => void copy()}
            className="tap flex items-center gap-3 rounded-control bg-tg-secondary px-4 py-3 text-left"
        >
            <span className="min-w-0 flex-1 truncate font-medium">{link}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand">
                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                {copied ? t.owner.settings.copied : t.owner.settings.copy}
            </span>
        </button>
    )
}

function DeliveryFields({
    form,
    patch,
}: {
    form: Form
    patch(change: Partial<Form>): void
}): React.JSX.Element {
    const s = useT().owner.settings
    return (
        <Section title={s.delivery} id={sectionId("delivery")}>
            <Field label={s.fee} htmlFor="fee">
                <MoneyInput id="fee" value={form.fee} onChange={(fee): void => patch({ fee })} />
            </Field>
            <Field label={s.freeFrom} htmlFor="free-from">
                <MoneyInput
                    id="free-from"
                    value={form.freeFrom}
                    onChange={(freeFrom): void => patch({ freeFrom })}
                />
            </Field>
            <Field label={s.minOrder} htmlFor="min-order">
                <MoneyInput
                    id="min-order"
                    value={form.minOrder}
                    onChange={(minOrder): void => patch({ minOrder })}
                />
            </Field>
            <Field label={s.radius} htmlFor="radius">
                <TextInput
                    id="radius"
                    inputMode="numeric"
                    value={form.radiusKm === null ? "" : String(form.radiusKm)}
                    onChange={(e): void => {
                        const digits = e.target.value.replace(/\D/g, "")
                        patch({
                            radiusKm: digits
                                ? Math.min(Number(digits), MAX_RADIUS_KM) || null
                                : null,
                        })
                    }}
                />
            </Field>
        </Section>
    )
}

function LocationFields({
    form,
    patch,
}: {
    form: Form
    patch(change: Partial<Form>): void
}): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    const locate = async (): Promise<void> => {
        haptic.tap()
        const found = await getLocation()
        if (found) {
            patch({ location: { latitude: found.latitude, longitude: found.longitude } })
            haptic.success()
        } else {
            toast(t.checkout.locationFailed, "error")
        }
    }
    return (
        <Section title={s.address} id={sectionId("location")}>
            <TextInput
                aria-label={s.address}
                value={form.address}
                maxLength={200}
                onChange={(e): void => patch({ address: e.target.value })}
            />
            <Button
                variant="secondary"
                icon={
                    <PinIcon size={18} className={form.location ? "text-success" : "text-brand"} />
                }
                onClick={(): void => void locate()}
            >
                {form.location ? s.setLocation : s.location}
            </Button>
        </Section>
    )
}

/** Vertical features the owner switches on or off; the bottle deposit lives with its switch. */
function FeatureFields({
    form,
    patch,
}: {
    form: Form
    patch(change: Partial<Form>): void
}): React.JSX.Element {
    const s = useT().owner.settings
    const toggle = (feature: Feature, on: boolean): void => {
        const rest = form.features.filter((f) => f !== feature)
        patch({ features: on ? [...rest, feature] : rest })
    }
    return (
        <Section title={s.features}>
            <div className="flex flex-col divide-y divide-tg-separator rounded-tile bg-tg-secondary px-4">
                {FEATURES.map((feature) => (
                    <label key={feature} className="flex min-h-[52px] items-center gap-3 py-2">
                        <span className="flex-1 font-medium">{s.featureNames[feature]}</span>
                        <Switch
                            checked={form.features.includes(feature)}
                            onChange={(on): void => toggle(feature, on)}
                            label={s.featureNames[feature]}
                        />
                    </label>
                ))}
            </div>
            {form.features.includes(Feature.BOTTLE_DEPOSIT) ? (
                <Field label={s.bottleDeposit} htmlFor="bottle-deposit">
                    <MoneyInput
                        id="bottle-deposit"
                        value={form.bottleDeposit}
                        onChange={(bottleDeposit): void => patch({ bottleDeposit })}
                    />
                </Field>
            ) : null}
        </Section>
    )
}

function SettingsForm({
    shop,
    onSaved,
}: {
    shop: ShopOwnerDTO
    onSaved(shop: ShopOwnerDTO): void
}): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    const [form, setForm] = useState<Form>(() => formOf(shop))
    const [saving, setSaving] = useState(false)
    const patch = (change: Partial<Form>): void => setForm((f) => ({ ...f, ...change }))
    const dirty = JSON.stringify(patchOf(form)) !== JSON.stringify(patchOf(formOf(shop)))
    const valid = form.name.trim().length > 0 && hasOpenDay(form.hours)

    const save = async (): Promise<void> => {
        setSaving(true)
        try {
            const saved = await api.owner.updateShop(patchOf(form))
            onSaved(saved)
            // Without a logo the bot's picture is the name on the shop's color: keep it current.
            if (
                !saved.logoKey &&
                (saved.name !== shop.name || saved.brandColor !== shop.brandColor)
            ) {
                void syncBotPhoto(t, {
                    shopName: saved.name,
                    brandColor: saved.brandColor,
                    logo: null,
                })
            }
            setForm(formOf(saved))
            haptic.success()
            toast(s.saved, "success")
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setSaving(false)
        }
    }

    useMainAction(
        dirty
            ? {
                  text: saving ? t.common.saving : t.common.save,
                  onClick: (): void => void save(),
                  loading: saving,
                  disabled: !valid,
              }
            : null,
    )

    return (
        <>
            <Section title={s.shop} id={sectionId("logo")}>
                <LogoPicker shop={shop} onSaved={onSaved} />
                <p className="-mt-1 px-1 text-sm text-tg-hint">{s.botPhotoHint}</p>
                <Field label={s.name} htmlFor="shop-name">
                    <TextInput
                        id="shop-name"
                        value={form.name}
                        maxLength={60}
                        onChange={(e): void => patch({ name: e.target.value })}
                    />
                </Field>
                <Field label={s.color}>
                    <ColorPicker
                        value={form.brandColor}
                        onChange={(brandColor): void => patch({ brandColor })}
                    />
                </Field>
            </Section>
            <DeliveryFields form={form} patch={patch} />
            <Section title={s.hours} id={sectionId("hours")}>
                <HoursEditor hours={form.hours} onChange={(hours): void => patch({ hours })} />
            </Section>
            <LocationFields form={form} patch={patch} />
            <FeatureFields form={form} patch={patch} />
        </>
    )
}

const JUMPS = ["logo", "delivery", "hours", "card", "courier"] as const

/** A long page: one row of chips goes straight to each group. */
function SettingsNav(): React.JSX.Element {
    const s = useT().owner.settings
    return (
        <nav aria-label={s.jumpTo} className="-mx-4 overflow-x-auto px-4">
            <ul className="flex gap-2">
                {JUMPS.map((id) => (
                    <li key={id}>
                        <button
                            type="button"
                            onClick={(): void => {
                                haptic.select()
                                document
                                    .getElementById(sectionId(id))
                                    ?.scrollIntoView({ behavior: "smooth" })
                            }}
                            className="tap min-h-11 whitespace-nowrap rounded-full bg-tg-secondary px-4 text-sm font-semibold"
                        >
                            {s.jump[id]}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    )
}

/** «Ishga tayyor» opened «Sozlamalar» for one part of it: bring that part into view, once. */
function useFocusSection(ready: boolean): void {
    const section = useOwner((state) => state.focusSection)
    const goToSection = useOwner((state) => state.goToSection)
    useEffect(() => {
        if (!ready || !section) {
            return
        }
        document.getElementById(sectionId(section))?.scrollIntoView({ behavior: "smooth" })
        goToSection(null)
    }, [ready, section, goToSection])
}

export function SettingsTab(): React.JSX.Element {
    const t = useT()
    const { shop, error, reload, setShop } = useOwnerShop()
    useFocusSection(shop !== null)
    if (error) {
        return (
            <EmptyState
                art={<WifiOffIcon size={44} />}
                title={errorText(t, error)}
                action={
                    <Button variant="secondary" onClick={(): void => void reload()}>
                        {t.common.retry}
                    </Button>
                }
            />
        )
    }
    if (!shop) {
        return (
            <div className="flex flex-col gap-3 px-4 pt-2">
                <Skeleton className="h-20 rounded-tile" />
                <Skeleton className="h-40 rounded-tile" />
            </div>
        )
    }
    return (
        <div className="flex flex-col gap-6 px-4 pt-2">
            <AcceptingCard shop={shop} onSaved={setShop} />
            <SettingsNav />
            <SettingsForm shop={shop} onSaved={setShop} />
            <div id={sectionId("card")} className="scroll-mt-24">
                <PaymentCardsSection onSaved={setShop} />
            </div>
            <div id={sectionId("courier")} className="scroll-mt-24">
                <CouriersSection shopName={shop.name} />
            </div>
            <NetworkSection shop={shop} onSaved={setShop} />
            <Section title={t.owner.settings.link}>
                <ShopLink shop={shop} />
            </Section>
            <PosterSection shop={shop} />
            <Section title={t.owner.settings.showcase}>
                <p className="rounded-tile bg-tg-secondary p-4 text-sm text-tg-subtitle">
                    {shop.marketplace
                        ? fill(t.owner.settings.showcaseOn, {
                              rate: String(
                                  shop.marketplace.commissionBps / BPS_PER_PERCENT,
                              ).replace(".", ","),
                          })
                        : t.owner.settings.showcaseOff}
                </p>
            </Section>
            <BottomSpacer />
        </div>
    )
}

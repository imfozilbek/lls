import { FEATURES, Feature, Phone, formatPhone } from "@zumda/core"
import { useCallback, useEffect, useRef, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api, imageUrl } from "../lib/api.js"
import { updateBotPhoto } from "../lib/bot-photo.js"
import { BRAND_SWATCHES, applyBrand, readableInk } from "../lib/brand.js"
import { cn } from "../lib/cn.js"
import { formatMoney, hexToRgbChannels } from "../lib/format.js"
import { compressImage } from "../lib/image.js"
import { useBackButton, useClosingGuard, useMainAction } from "../lib/main-button.js"
import { useRefresh } from "../lib/refresh.js"
import { confirm, getLocation, haptic } from "../lib/telegram.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { AlertIcon, CheckIcon, ChevronIcon, CopyIcon, PinIcon, WifiOffIcon } from "../ui/icons.js"
import { PlacePick } from "../ui/maps.js"
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
import { SoundSwitch } from "../ui/sound-switch.js"

import { CouriersSection, NetworkSection } from "./CouriersSection.js"
import { HoursEditor } from "./HoursEditor.js"
import { PaymentCardsSection } from "./PaymentCardsSection.js"
import { PaymentOptionsSection } from "./PaymentOptionsSection.js"
import { PosterSection } from "./PosterSection.js"
import { hasOpenDay, hoursOf, scheduleOf } from "./hours.js"
import { useOwner } from "./store.js"
import { saveTick } from "./ticks.js"

import type { Hours } from "./hours.js"
import type { ReadySection } from "./store.js"
import type { Dictionary } from "../i18n/index.js"
import type { ShopPatch } from "../lib/api.js"
import type { BotAvatarInput } from "../lib/bot-avatar.js"
import type { ShopOwnerDTO } from "@zumda/core"

interface Form {
    name: string
    brandColor: string
    address: string
    location: { latitude: number; longitude: number } | null
    /** The number customers call about an order, as the owner typed it; empty = none. */
    contactPhone: string
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
const PHONE_TEXT = /^[+\d\s()-]*$/

/** Empty, or a number the Worker will take: the same check as `Phone` in the core. */
function isPhoneText(text: string): boolean {
    if (!text.trim()) {
        return true
    }
    if (!PHONE_TEXT.test(text)) {
        return false
    }
    try {
        Phone.create(text)
        return true
    } catch {
        return false
    }
}
const BPS_PER_PERCENT = 100
const MAX_RADIUS_KM = 100

function formOf(shop: ShopOwnerDTO): Form {
    return {
        name: shop.name,
        brandColor: shop.brandColor,
        address: shop.address ?? "",
        location: shop.location ?? null,
        contactPhone: shop.contactPhone ? formatPhone(shop.contactPhone) : "",
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
        contactPhone: form.contactPhone.trim() || null,
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
    const t = useT()
    const loaded = useRef(false)
    const loadCouriers = useOwner((state) => state.loadCouriers)
    const reload = async (): Promise<void> => {
        setError(null)
        try {
            setShopState(await api.owner.shop())
            loaded.current = true
        } catch (caught) {
            const code = caught instanceof ApiError ? caught.code : "generic"
            // Settings already on screen stay; only a first load shows the error in their place.
            if (loaded.current) {
                toast(errorText(t, code), "error")
            } else {
                setError(code)
            }
        }
    }
    useEffect(() => {
        void reload()
    }, [])
    useRefresh(() => Promise.all([reload(), loadCouriers().catch(() => undefined)]))
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
                value ? "bg-brand/10" : "bg-warning/15",
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
    const s = t.owner.settings
    // A color chosen before the swatches changed stays visible, and chosen, at the front.
    const own = !BRAND_SWATCHES.some((color) => color.toLowerCase() === value.toLowerCase())
    const colors: string[] = own ? [value, ...BRAND_SWATCHES] : [...BRAND_SWATCHES]
    return (
        <div
            className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] justify-items-center gap-y-2"
            role="radiogroup"
            aria-label={s.color}
        >
            {colors.map((color, index) => {
                const selected = color.toLowerCase() === value.toLowerCase()
                return (
                    <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={
                            own && index === 0
                                ? s.currentColor
                                : (s.colorNames[index - (own ? 1 : 0)] ?? color)
                        }
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
        <Section id={sectionId("delivery")}>
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
            <Field label={s.radius} htmlFor="radius" hint={s.radiusHint}>
                <TextInput
                    id="radius"
                    inputMode="numeric"
                    placeholder={s.radiusNone}
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
        <Section id={sectionId("location")}>
            <TextInput
                aria-label={s.address}
                value={form.address}
                maxLength={200}
                onChange={(e): void => patch({ address: e.target.value })}
            />
            <PlacePick
                value={form.location}
                onChange={(location): void => patch({ location })}
                zone={
                    form.location && form.radiusKm
                        ? { center: form.location, radiusMeters: form.radiusKm * 1000 }
                        : null
                }
                pin="shop"
                fallback={
                    <Button
                        variant="secondary"
                        icon={
                            <PinIcon
                                size={18}
                                className={form.location ? "text-success" : "text-brand"}
                            />
                        }
                        onClick={(): void => void locate()}
                    >
                        {form.location ? s.setLocation : s.location}
                    </Button>
                }
            />
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
        <Section>
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

/** Logo, name, color and the number customers call. */
function ShopFields({
    shop,
    onSaved,
    form,
    patch,
}: {
    shop: ShopOwnerDTO
    onSaved(shop: ShopOwnerDTO): void
    form: Form
    patch(change: Partial<Form>): void
}): React.JSX.Element {
    const s = useT().owner.settings
    const phoneOk = isPhoneText(form.contactPhone)
    return (
        <Section id={sectionId("logo")}>
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
            <Field
                label={s.contactPhone}
                htmlFor="contact-phone"
                hint={
                    phoneOk ? (
                        s.contactPhoneHint
                    ) : (
                        <span className="text-destructive">{s.contactPhoneBad}</span>
                    )
                }
            >
                <TextInput
                    id="contact-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+998 90 123 45 67"
                    value={form.contactPhone}
                    maxLength={25}
                    aria-invalid={!phoneOk}
                    onChange={(e): void => patch({ contactPhone: e.target.value })}
                />
            </Field>
        </Section>
    )
}

/** The parts of «Sozlamalar»: the first screen lists them, a tap opens one. */
type SettingsGroup =
    "shop" | "delivery" | "hours" | "location" | "features" | "card" | "courier" | "link"

const GROUPS: SettingsGroup[] = [
    "shop",
    "delivery",
    "hours",
    "location",
    "card",
    "courier",
    "features",
    "link",
]

/** Where each step of «Ishga tayyor» leads. */
const READY_GROUP: Record<ReadySection, SettingsGroup> = {
    logo: "shop",
    phone: "shop",
    card: "card",
    location: "location",
    hours: "hours",
    courier: "courier",
}

type Settings = Dictionary["owner"]["settings"]

function groupTitle(s: Settings, group: SettingsGroup): string {
    const titles: Record<SettingsGroup, string> = {
        shop: s.shop,
        delivery: s.delivery,
        hours: s.hours,
        location: s.address,
        features: s.features,
        card: s.paymentGroup,
        courier: s.couriers,
        link: s.linkGroup,
    }
    return titles[group]
}

function hoursSummary(s: Settings, hours: Hours): string {
    if (hours.alwaysOpen) {
        return s.alwaysOpen
    }
    const open = hours.days.flatMap((day, index) => (day.open ? [{ ...day, index }] : []))
    const first = open[0]
    if (!first) {
        return s.summary.closed
    }
    const days =
        open.length === hours.days.length
            ? s.summary.everyDay
            : open.map((day) => s.days[day.index]).join(", ")
    const same = open.every((day) => day.from === first.from && day.to === first.to)
    return same ? `${days} · ${first.from}-${first.to}` : days
}

/** «Karta · •••• 9012», «Naqd pul»; a warning when no way of paying works. */
function paymentSummary(s: Settings, shop: ShopOwnerDTO): { text: string; warn?: boolean } {
    if (shop.paymentMethods.length === 0) {
        return { text: s.summary.noCard, warn: true }
    }
    const card = shop.paymentOptions === "cash" ? undefined : shop.payoutCard
    const tail = card ? `•••• ${card.number.slice(-4)}` : null
    return {
        text: [s.summary.payment[shop.paymentOptions], tail].filter(Boolean).join(" · "),
    }
}

/** One line under each part's name: what is set there now. */
function useSummaries(shop: ShopOwnerDTO): Record<SettingsGroup, { text: string; warn?: boolean }> {
    const t = useT()
    const s = t.owner.settings
    const language = useLanguage()
    const couriers = useOwner((state) => state.couriers)
    const loadCouriers = useOwner((state) => state.loadCouriers)
    useEffect(() => {
        if (couriers === null) {
            loadCouriers().catch(() => undefined)
        }
    }, [couriers, loadCouriers])
    const { fee } = shop.delivery
    const radius = shop.deliveryRadiusMeters
    const on = shop.features.map((f) => s.featureNames[f])
    const team = couriers?.filter((c) => c.status === "active").length
    return {
        shop: {
            text: [shop.name, shop.contactPhone && formatPhone(shop.contactPhone)]
                .filter(Boolean)
                .join(" · "),
        },
        delivery: {
            text: [
                fee > 0 ? formatMoney(fee, language) : s.summary.free,
                radius ? fill(s.summary.radius, { km: String(radius / METERS_PER_KM) }) : null,
            ]
                .filter(Boolean)
                .join(" · "),
        },
        hours: { text: hoursSummary(s, hoursOf(shop.workingHours)) },
        location: shop.location
            ? { text: shop.address || s.summary.onMap }
            : { text: s.summary.noLocation, warn: true },
        features: { text: on.length > 0 ? on.join(", ") : s.summary.noFeatures },
        card: paymentSummary(s, shop),
        courier: {
            text:
                team === undefined
                    ? s.summary.couriersHint
                    : team > 0
                      ? fill(s.summary.couriers, { n: String(team) })
                      : s.summary.noCouriers,
        },
        link: { text: `t.me/${shop.botUsername}` },
    }
}

/** The first screen: every part with what is set in it, one tap to open. */
function GroupList({
    shop,
    onOpen,
}: {
    shop: ShopOwnerDTO
    onOpen(group: SettingsGroup): void
}): React.JSX.Element {
    const s = useT().owner.settings
    const summaries = useSummaries(shop)
    return (
        <ul className="flex flex-col divide-y divide-tg-separator overflow-hidden rounded-tile bg-tg-secondary">
            {GROUPS.map((group) => {
                const summary = summaries[group]
                return (
                    <li key={group}>
                        <button
                            type="button"
                            onClick={(): void => {
                                haptic.select()
                                onOpen(group)
                            }}
                            className="tap flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left"
                        >
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold">{groupTitle(s, group)}</span>
                                <span
                                    className={cn(
                                        "flex items-center gap-1.5 text-sm",
                                        summary.warn ? "text-warning" : "text-tg-hint",
                                    )}
                                >
                                    {summary.warn ? (
                                        <AlertIcon size={14} className="shrink-0" />
                                    ) : null}
                                    <span className="truncate">{summary.text}</span>
                                </span>
                            </span>
                            <ChevronIcon size={18} className="shrink-0 text-tg-hint" />
                        </button>
                    </li>
                )
            })}
        </ul>
    )
}

/** The form behind the parts with «Saqlash»: one state, so a part never loses another's edit. */
function useSettingsForm(
    shop: ShopOwnerDTO,
    onSaved: (shop: ShopOwnerDTO) => void,
): {
    form: Form
    patch(change: Partial<Form>): void
    dirty: boolean
    reset(): void
} {
    const t = useT()
    const s = t.owner.settings
    const [form, setForm] = useState<Form>(() => formOf(shop))
    const [saving, setSaving] = useState(false)
    const patch = (change: Partial<Form>): void => setForm((f) => ({ ...f, ...change }))
    const dirty = JSON.stringify(patchOf(form)) !== JSON.stringify(patchOf(formOf(shop)))
    const setSettingsDirty = useOwner((state) => state.setSettingsDirty)
    useClosingGuard(dirty)
    useEffect(() => {
        setSettingsDirty(dirty)
        return (): void => setSettingsDirty(false)
    }, [dirty, setSettingsDirty])
    const valid =
        form.name.trim().length > 0 && hasOpenDay(form.hours) && isPhoneText(form.contactPhone)

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
    return { form, patch, dirty, reset: (): void => setForm(formOf(shop)) }
}

/** One part of «Sozlamalar», opened from the list. */
function GroupBody({
    group,
    shop,
    onSaved,
    form,
    patch,
}: {
    group: SettingsGroup
    shop: ShopOwnerDTO
    onSaved(shop: ShopOwnerDTO): void
    form: Form
    patch(change: Partial<Form>): void
}): React.JSX.Element {
    const settings = useT().owner.settings
    switch (group) {
        case "shop":
            return <ShopFields shop={shop} onSaved={onSaved} form={form} patch={patch} />
        case "delivery":
            return <DeliveryFields form={form} patch={patch} />
        case "hours":
            return (
                <Section id={sectionId("hours")}>
                    <HoursEditor hours={form.hours} onChange={(hours): void => patch({ hours })} />
                </Section>
            )
        case "location":
            return <LocationFields form={form} patch={patch} />
        case "features":
            return <FeatureFields form={form} patch={patch} />
        case "card":
            return (
                <>
                    <PaymentOptionsSection shop={shop} onSaved={onSaved} />
                    {shop.paymentOptions === "cash" ? null : (
                        <PaymentCardsSection title={settings.payoutCard} onSaved={onSaved} />
                    )}
                </>
            )
        case "courier":
            return (
                <>
                    <CouriersSection shopName={shop.name} />
                    <NetworkSection shop={shop} onSaved={onSaved} />
                </>
            )
        case "link":
            return <LinkGroup shop={shop} />
    }
}

function LinkGroup({ shop }: { shop: ShopOwnerDTO }): React.JSX.Element {
    const s = useT().owner.settings
    return (
        <>
            <Section title={s.link}>
                <ShopLink shop={shop} />
            </Section>
            <PosterSection shop={shop} />
            <Section title={s.showcase}>
                <p className="rounded-tile bg-tg-secondary p-4 text-sm text-tg-subtitle">
                    {shop.marketplace
                        ? fill(s.showcaseOn, {
                              rate: String(
                                  shop.marketplace.commissionBps / BPS_PER_PERCENT,
                              ).replace(".", ","),
                          })
                        : s.showcaseOff}
                </p>
            </Section>
        </>
    )
}

/** «Ishga tayyor» (or the no-card banner) asked for one part: open it, once. */
function useFocusGroup(open: (group: SettingsGroup) => void): void {
    const section = useOwner((state) => state.focusSection)
    const goToSection = useOwner((state) => state.goToSection)
    useEffect(() => {
        if (section) {
            open(READY_GROUP[section])
            goToSection(null)
        }
    }, [section, goToSection, open])
}

function SettingsBody({
    shop,
    onSaved,
}: {
    shop: ShopOwnerDTO
    onSaved(shop: ShopOwnerDTO): void
}): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    const [group, setGroup] = useState<SettingsGroup | null>(null)
    const { form, patch, dirty, reset } = useSettingsForm(shop, (saved): void => {
        // Hours saved as 24/7 look like hours never set: the owner's save is the tick.
        if (group === "hours") {
            saveTick("hours", saved.id)
        }
        onSaved(saved)
    })
    const open = useCallback((next: SettingsGroup): void => {
        setGroup(next)
        window.scrollTo({ top: 0 })
    }, [])
    useFocusGroup(open)
    const leave = async (): Promise<void> => {
        const options = { yes: t.common.leave, no: t.common.stay, destructive: true }
        if (dirty && !(await confirm(s.unsavedLeave, options))) {
            return
        }
        reset()
        setGroup(null)
        window.scrollTo({ top: 0 })
    }
    useBackButton(group ? (): void => void leave() : null)

    if (!group) {
        return (
            <div className="flex animate-fade-in flex-col gap-6 px-4 pt-2">
                <AcceptingCard shop={shop} onSaved={onSaved} />
                <GroupList shop={shop} onOpen={open} />
                <SoundSwitch />
                <BottomSpacer />
            </div>
        )
    }
    return (
        <section
            key={group}
            aria-label={groupTitle(s, group)}
            className="flex animate-fade-in flex-col gap-6 px-4 pt-2"
        >
            <button
                type="button"
                onClick={(): void => void leave()}
                className="tap -ml-1 flex min-h-11 items-center gap-1 self-start rounded-control px-1 text-sm font-semibold text-brand"
            >
                <ChevronIcon size={16} className="rotate-180" />
                {t.owner.tabs.settings}
            </button>
            <h1 className="-mt-4 px-1 text-2xl font-bold">{groupTitle(s, group)}</h1>
            <GroupBody group={group} shop={shop} onSaved={onSaved} form={form} patch={patch} />
            <BottomSpacer />
        </section>
    )
}

export function SettingsTab(): React.JSX.Element {
    const t = useT()
    const { shop, error, reload, setShop } = useOwnerShop()
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
    return <SettingsBody shop={shop} onSaved={setShop} />
}

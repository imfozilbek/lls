import { useState } from "react"

import { fill, useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { kmText } from "../lib/format.js"
import { metersBetween } from "../lib/map.js"
import { getLocation, haptic, locationDenied, openLocationSettings } from "../lib/telegram.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { CheckIcon, PinIcon } from "../ui/icons.js"
import { PlacePick } from "../ui/place-pick.js"
import { Field, Section, TextInput } from "../ui/primitives.js"

import type { Draft, Point } from "../lib/address-book.js"
import type { Shop } from "../stores/session.js"
import type { MapMarker } from "../ui/maps.js"

/** What the customer fills in for the delivery (kept as a draft on every change). */
export type Delivery = Draft

export const CHECKOUT_ADDRESS = "checkout-address"

/** A shop that delivers within a radius takes orders only with the pin (`LOCATION_REQUIRED`). */
export function needsPin(shop: Shop | null): boolean {
    return shop?.delivery.radiusMeters !== undefined
}

/** The pin lies beyond the shop's delivery radius: the Worker would refuse the order. */
export function outsideZone(shop: Shop | null, location: Point | null): boolean {
    const radius = shop?.delivery.radiusMeters
    if (!shop?.location || radius === undefined || !location) {
        return false
    }
    return metersBetween(shop.location, location) > radius
}

/** Everything a courier needs is there: the place named, the pin where the shop needs it. */
export function addressComplete(delivery: Delivery, shop: Shop | null): boolean {
    const hasPin = delivery.location !== null
    const named = delivery.address.trim() !== "" || (hasPin && delivery.landmark.trim() !== "")
    return named && (hasPin || !needsPin(shop)) && !outsideZone(shop, delivery.location)
}

/** The shop's own pin on the checkout map, when it has a place. */
function shopMarker(shop: Shop | null, title: string): MapMarker[] {
    return shop?.location ? [{ id: "shop", point: shop.location, kind: "shop", title }] : []
}

/** The place from Telegram in one tap: the first way to give it, the map second. */
function LocationButton({
    saved,
    onLocate,
}: {
    saved: boolean
    onLocate(): void
}): React.JSX.Element {
    const t = useT()
    return (
        <button
            type="button"
            onClick={onLocate}
            className={cn(
                "tap flex h-12 items-center justify-center gap-2 rounded-control font-semibold text-tg-text transition-colors duration-200",
                saved ? "bg-success/15" : "bg-brand/15",
            )}
        >
            {saved ? (
                <CheckIcon size={20} className="text-success" />
            ) : (
                <PinIcon size={20} className="text-brand" />
            )}
            {saved ? t.checkout.locationSaved : t.checkout.shareLocation}
        </button>
    )
}

/**
 * The location was refused once: Telegram never asks again by itself. Its settings for this bot
 * open from here (a tap is required), or the map does the job.
 */
function DeniedNote(): React.JSX.Element {
    const t = useT()
    return (
        <div className="flex items-center gap-3 rounded-control bg-warning/15 px-4 py-3">
            <p className="flex-1 text-sm">{t.checkout.locationDenied}</p>
            <button
                type="button"
                onClick={(): void => {
                    if (!openLocationSettings()) {
                        toast(t.map.deniedMove, "error")
                    }
                }}
                className="tap min-h-11 shrink-0 rounded-control bg-tg-bg px-3 text-sm font-semibold text-brand"
            >
                {t.checkout.openSettings}
            </button>
        </div>
    )
}

/** A returning customer's place in one line: «O'zgartirish» opens the fields again. */
export function AddressSummary({
    value,
    onEdit,
}: {
    value: Delivery
    onEdit(): void
}): React.JSX.Element {
    const t = useT()
    const words = [value.address.trim(), value.landmark.trim()].filter(Boolean).join(" · ")
    return (
        <Section title={t.checkout.address} id={CHECKOUT_ADDRESS}>
            <div className="flex items-center gap-3 rounded-control bg-tg-secondary px-4 py-3">
                <PinIcon size={20} className="shrink-0 text-brand" />
                <p className="min-w-0 flex-1 font-medium">{words}</p>
                <button
                    type="button"
                    onClick={(): void => {
                        haptic.tap()
                        onEdit()
                    }}
                    className="tap min-h-11 shrink-0 rounded-control px-2 text-sm font-semibold text-brand"
                >
                    {t.checkout.change}
                </button>
            </div>
        </Section>
    )
}

function useLocate(onFound: (point: Point) => void): { denied: boolean; locate(): void } {
    const t = useT()
    const [denied, setDenied] = useState(false)
    const locate = async (): Promise<void> => {
        haptic.tap()
        const found = await getLocation()
        if (found) {
            onFound({ latitude: found.latitude, longitude: found.longitude })
            setDenied(false)
            haptic.success()
            return
        }
        setDenied(locationDenied())
        toast(t.checkout.locationFailed, "error")
    }
    return { denied, locate: (): void => void locate() }
}

export function AddressSection({
    value,
    onChange,
}: {
    value: Delivery
    onChange(change: Partial<Delivery>): void
}): React.JSX.Element {
    const t = useT()
    const shop = useSession((state) => state.shop)
    const radius = shop?.delivery.radiusMeters
    const { denied, locate } = useLocate((location) => onChange({ location }))
    const hasPin = value.location !== null
    const tooFar = outsideZone(shop, value.location)
    return (
        <Section title={t.checkout.address} id={CHECKOUT_ADDRESS}>
            {/* The pin first: one tap, and the courier finds the door even without words. */}
            <PlacePick
                value={value.location}
                onChange={(location, street): void =>
                    // The street the map knows fills an empty field: only the house is left.
                    onChange({
                        location,
                        ...(street && !value.address.trim() ? { address: street } : {}),
                    })
                }
                start={shop?.location}
                zone={
                    shop?.location && radius !== undefined
                        ? { center: shop.location, radiusMeters: radius }
                        : null
                }
                markers={shopMarker(shop, t.map.shop)}
                warnNear={
                    shop?.location ? { point: shop.location, ask: t.map.nearShop } : undefined
                }
                quick={<LocationButton saved={false} onLocate={locate} />}
                fallback={<LocationButton saved={hasPin} onLocate={locate} />}
            />
            {denied ? <DeniedNote /> : null}
            <p
                className={cn(
                    "-mt-1 px-1 text-sm",
                    tooFar ? "font-medium text-tg-destructive" : "text-tg-hint",
                )}
            >
                {tooFar && radius !== undefined
                    ? fill(t.map.outsideZone, { km: kmText(radius) })
                    : radius === undefined
                      ? t.checkout.pinHelps
                      : fill(t.checkout.pinRequired, { km: kmText(radius) })}
            </p>
            {/* With the pin one of the two is enough: said once, above both. */}
            {hasPin ? (
                <p className="px-1 text-sm text-tg-hint">{t.checkout.streetOrLandmark}</p>
            ) : null}
            <Field label={t.checkout.street} htmlFor="street">
                <TextInput
                    id="street"
                    aria-label={t.checkout.address}
                    value={value.address}
                    onChange={(e): void => onChange({ address: e.target.value })}
                    placeholder={t.checkout.addressPlaceholder}
                    maxLength={200}
                    autoComplete="street-address"
                />
            </Field>
            <Field
                label={
                    hasPin ? t.checkout.landmark : `${t.checkout.landmark} (${t.checkout.optional})`
                }
                htmlFor="landmark"
            >
                <TextInput
                    id="landmark"
                    value={value.landmark}
                    onChange={(e): void => onChange({ landmark: e.target.value })}
                    placeholder={t.checkout.landmarkPlaceholder}
                    maxLength={200}
                />
            </Field>
        </Section>
    )
}

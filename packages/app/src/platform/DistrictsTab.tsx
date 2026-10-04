import { useCallback, useEffect, useRef, useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, adminApi } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { useRefresh } from "../lib/refresh.js"
import { getLocation, haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { ChevronIcon, PinIcon, PlusIcon, WifiOffIcon } from "../ui/icons.js"
import { PlacePick } from "../ui/maps.js"
import { Button, EmptyState, Field, Skeleton, TextInput } from "../ui/primitives.js"
import { Sheet } from "../ui/sheet.js"

import { failToast } from "./shared.js"

import type { DistrictInput } from "../lib/api.js"
import type { DistrictStats } from "@zumda/core"

const DEFAULT_WAIT_MINUTES = 10
const COORDINATE_DIGITS = 5
const MIN_RADIUS_KM = 0.5
const MAX_RADIUS_KM = 200

/** "38.9785, 66.6831" (a comma or a space between), or null. */
function parseCenter(text: string): { latitude: number; longitude: number } | null {
    const parts = text.trim().split(/[\s,;]+/)
    if (parts.length !== 2) {
        return null
    }
    const [latitude, longitude] = parts.map(Number)
    if (
        latitude === undefined ||
        longitude === undefined ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
    ) {
        return null
    }
    return { latitude, longitude }
}

function centerText(center: { latitude: number; longitude: number }): string {
    return `${center.latitude.toFixed(COORDINATE_DIGITS)}, ${center.longitude.toFixed(COORDINATE_DIGITS)}`
}

function decimal(text: string): number {
    return Number(text.trim().replace(",", "."))
}

interface DistrictForm {
    name: string
    center: string
    radius: string
    wait: string
}

function formOf(district: DistrictStats | null): DistrictForm {
    return {
        name: district?.name ?? "",
        center: district ? centerText(district.center) : "",
        radius: district ? String(district.radiusKm) : "",
        wait: String(district?.waitMinutes ?? DEFAULT_WAIT_MINUTES),
    }
}

/** What the form would save, or null while something is missing or out of range. */
function districtInput(form: DistrictForm): DistrictInput | null {
    const center = parseCenter(form.center)
    const radiusKm = decimal(form.radius)
    const waitMinutes = Number(form.wait)
    const name = form.name.trim()
    const radiusOk = radiusKm >= MIN_RADIUS_KM && radiusKm <= MAX_RADIUS_KM
    if (name.length < 2 || !center || !radiusOk || !Number.isInteger(waitMinutes)) {
        return null
    }
    return waitMinutes >= 1 ? { name, center, radiusKm, waitMinutes } : null
}

/** The circle's center: typed, or where the admin stands now. */
function CenterField({
    value,
    radiusKm,
    onChange,
}: {
    value: string
    /** The radius typed so far: the map shows the circle. */
    radiusKm: number
    onChange(center: string): void
}): React.JSX.Element {
    const t = useT()
    const p = t.platform
    const center = parseCenter(value)
    const bad = value !== "" && center === null
    const locate = async (): Promise<void> => {
        const found = await getLocation()
        if (found) {
            haptic.success()
            onChange(centerText(found))
        } else {
            toast(t.checkout.locationFailed, "error")
        }
    }
    return (
        <Field label={p.center} hint={bad ? p.badCenter : p.centerHint} htmlFor="district-center">
            <TextInput
                id="district-center"
                inputMode="decimal"
                value={value}
                placeholder={p.centerPlaceholder}
                aria-invalid={bad}
                onChange={(e): void => onChange(e.target.value)}
            />
            <PlacePick
                value={center}
                onChange={(point): void => onChange(centerText(point))}
                zone={center && radiusKm > 0 ? { center, radiusMeters: radiusKm * 1000 } : null}
                title={p.center}
                fallback={
                    <Button
                        variant="secondary"
                        icon={<PinIcon size={18} className="text-brand" />}
                        onClick={(): void => void locate()}
                    >
                        {p.useMyLocation}
                    </Button>
                }
            />
        </Field>
    )
}

/** A new district, or a change to one: the name is its key, so it stays as it was. */
function DistrictSheet({
    district,
    onSaved,
    onClose,
}: {
    district: DistrictStats | null
    onSaved(): void
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    const p = t.platform
    const [form, setForm] = useState<DistrictForm>(() => formOf(district))
    const [busy, setBusy] = useState(false)
    const patch = (next: Partial<DistrictForm>): void => setForm((f) => ({ ...f, ...next }))
    const input = districtInput(form)

    const save = async (): Promise<void> => {
        if (!input) {
            return
        }
        setBusy(true)
        try {
            await adminApi.saveDistrict(input)
            haptic.success()
            toast(fill(p.districtSaved, { name: input.name }), "success")
            onSaved()
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setBusy(false)
        }
    }

    return (
        <Sheet title={district ? p.editDistrict : p.addDistrict} onClose={onClose}>
            <Field label={p.districtName} htmlFor="district-name">
                <TextInput
                    id="district-name"
                    value={form.name}
                    maxLength={60}
                    readOnly={district !== null}
                    placeholder={p.districtNamePlaceholder}
                    onChange={(e): void => patch({ name: e.target.value })}
                />
            </Field>
            <CenterField
                value={form.center}
                radiusKm={decimal(form.radius) || 0}
                onChange={(center): void => patch({ center })}
            />
            <div className="grid grid-cols-2 gap-3">
                <Field label={p.radius} htmlFor="district-radius">
                    <TextInput
                        id="district-radius"
                        inputMode="decimal"
                        value={form.radius}
                        maxLength={5}
                        onChange={(e): void => patch({ radius: e.target.value })}
                    />
                </Field>
                <Field label={p.wait} htmlFor="district-wait">
                    <TextInput
                        id="district-wait"
                        inputMode="numeric"
                        value={form.wait}
                        maxLength={3}
                        onChange={(e): void => patch({ wait: e.target.value.replace(/\D/g, "") })}
                    />
                </Field>
            </div>
            <Button
                size="lg"
                loading={busy}
                disabled={input === null}
                onClick={(): void => void save()}
            >
                {t.common.save}
            </Button>
        </Sheet>
    )
}

function Stat({
    label,
    value,
    alert = false,
}: {
    label: string
    value: number
    alert?: boolean
}): React.JSX.Element {
    return (
        <div className={cn("rounded-control px-3 py-2", alert ? "bg-warning/15" : "bg-tg-bg")}>
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <p className="text-xs font-medium text-tg-subtitle">{label}</p>
        </div>
    )
}

function DistrictCard({
    district,
    onEdit,
}: {
    district: DistrictStats
    onEdit(): void
}): React.JSX.Element {
    const p = useT().platform
    return (
        <li>
            <button
                type="button"
                onClick={(): void => {
                    haptic.tap()
                    onEdit()
                }}
                className="tap flex w-full animate-rise flex-col gap-3 rounded-tile bg-tg-secondary p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
                <span className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-brand/15 text-brand">
                        <PinIcon size={22} />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg font-bold">{district.name}</span>
                        <span className="block text-sm text-tg-hint">
                            {fill(p.km, { km: district.radiusKm })} ·{" "}
                            {fill(p.waitLine, { min: district.waitMinutes })}
                        </span>
                    </span>
                    <ChevronIcon size={18} className="text-tg-hint" />
                </span>
                <span className="grid grid-cols-3 gap-2">
                    <Stat label={p.shopsInside} value={district.shops} />
                    <Stat label={p.freeCouriers} value={district.freeCouriers} />
                    <Stat label={p.waiting} value={district.waiting} alert={district.waiting > 0} />
                </span>
                <span className="px-1 text-sm text-tg-subtitle">
                    {fill(p.week, { delivered: district.delivered, network: district.viaNetwork })}
                </span>
            </button>
        </li>
    )
}

/** «Tumanlar»: each circle of the delivery network, how it does now and this week. */
export function DistrictsTab(): React.JSX.Element {
    const t = useT()
    const p = t.platform
    const [districtList, setDistrictState] = useState<DistrictStats[] | null>(null)
    // The latest list for the loader: an error while it is on screen is only a toast.
    const districts = useRef<DistrictStats[] | null>(null)
    const setDistricts = (next: DistrictStats[]): void => {
        districts.current = next
        setDistrictState(next)
    }
    const [error, setError] = useState<string | null>(null)
    const [editing, setEditing] = useState<DistrictStats | "new" | null>(null)
    const load = useCallback(async (): Promise<void> => {
        setError(null)
        try {
            setDistricts(await adminApi.districts())
        } catch (caught) {
            const code = caught instanceof ApiError ? caught.code : "generic"
            if (districts.current) {
                toast(errorText(t, code), "error")
            } else {
                setError(code)
            }
        }
    }, [t])
    useEffect(() => {
        void load()
    }, [load])
    useRefresh(editing ? null : load)

    let body: React.JSX.Element
    if (error) {
        body = (
            <EmptyState
                art={<WifiOffIcon size={44} />}
                title={errorText(t, error)}
                action={
                    <Button variant="secondary" onClick={(): void => void load()}>
                        {t.common.retry}
                    </Button>
                }
            />
        )
    } else if (districtList === null) {
        body = <Skeleton className="h-44 rounded-tile" />
    } else if (districtList.length === 0) {
        body = (
            <EmptyState
                art={<PinIcon size={44} />}
                title={p.noDistricts}
                text={p.noDistrictsText}
            />
        )
    } else {
        body = (
            <ul className="flex flex-col gap-3">
                {districtList.map((district) => (
                    <DistrictCard
                        key={district.id}
                        district={district}
                        onEdit={(): void => setEditing(district)}
                    />
                ))}
            </ul>
        )
    }
    return (
        <div className="flex flex-col gap-4">
            {body}
            {error ? null : (
                <Button
                    variant="secondary"
                    icon={<PlusIcon size={18} className="text-brand" />}
                    onClick={(): void => setEditing("new")}
                >
                    {p.addDistrict}
                </Button>
            )}
            {editing ? (
                <DistrictSheet
                    district={editing === "new" ? null : editing}
                    onClose={(): void => setEditing(null)}
                    onSaved={(): void => {
                        setEditing(null)
                        void load()
                    }}
                />
            ) : null}
        </div>
    )
}

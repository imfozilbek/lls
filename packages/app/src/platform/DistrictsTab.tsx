import { useCallback, useEffect, useRef, useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, adminApi } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { useClosingGuard } from "../lib/main-button.js"
import { useRefresh } from "../lib/refresh.js"
import { confirm, getLocation, haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { CheckIcon, ChevronIcon, PinIcon, PlusIcon, WifiOffIcon } from "../ui/icons.js"
import { PlacePick } from "../ui/place-pick.js"
import { Button, EmptyState, Field, Skeleton, TextInput } from "../ui/primitives.js"
import { Sheet } from "../ui/sheet.js"

import { RegionField } from "./RegionField.js"
import { byRegion, regionName } from "./regions.js"
import { failToast } from "./shared.js"

import type { DistrictInput } from "../lib/api.js"
import type { Point } from "../lib/map.js"
import type { DistrictStats, Region } from "@zumda/core"

const DEFAULT_WAIT_MINUTES = 10
const MIN_RADIUS_KM = 0.5
const MAX_RADIUS_KM = 200

function decimal(text: string): number {
    return Number(text.trim().replace(",", "."))
}

interface DistrictForm {
    name: string
    /** None until picked: a district made before the viloyat was asked asks for it. */
    region: Region | null
    /** Picked on the map (or where the admin stands): never typed, never shown as numbers. */
    center: Point | null
    radius: string
    wait: string
}

function formOf(district: DistrictStats | null): DistrictForm {
    return {
        name: district?.name ?? "",
        region: district?.region ?? null,
        center: district?.center ?? null,
        radius: district ? String(district.radiusKm) : "",
        wait: String(district?.waitMinutes ?? DEFAULT_WAIT_MINUTES),
    }
}

/** What the form would save, or null while something is missing or out of range. */
function districtInput(form: DistrictForm): DistrictInput | null {
    const radiusKm = decimal(form.radius)
    const waitMinutes = Number(form.wait)
    const name = form.name.trim()
    const radiusOk = radiusKm >= MIN_RADIUS_KM && radiusKm <= MAX_RADIUS_KM
    const { region, center } = form
    if (name.length < 2 || !region || !center || !radiusOk || !Number.isInteger(waitMinutes)) {
        return null
    }
    return waitMinutes >= 1 ? { name, region, center, radiusKm, waitMinutes } : null
}

/**
 * The circle's center: picked on the map with the circle drawn, or, before the map is there,
 * where the admin stands now. Coordinates are never shown (owner's decision, October 2026).
 */
function CenterField({
    value,
    radiusKm,
    onChange,
}: {
    value: Point | null
    /** The radius typed so far: the map shows the circle. */
    radiusKm: number
    onChange(center: Point): void
}): React.JSX.Element {
    const t = useT()
    const p = t.platform
    const locate = async (): Promise<void> => {
        const found = await getLocation()
        if (found) {
            haptic.success()
            onChange({ latitude: found.latitude, longitude: found.longitude })
        } else {
            toast(t.checkout.locationFailed, "error")
        }
    }
    return (
        <div className="flex flex-col gap-1.5">
            <p className="px-1 text-sm font-medium text-tg-subtitle">{p.center}</p>
            <PlacePick
                value={value}
                onChange={(point): void => onChange(point)}
                zone={
                    value && radiusKm > 0 ? { center: value, radiusMeters: radiusKm * 1000 } : null
                }
                title={p.center}
                fallback={
                    <>
                        {value ? (
                            <p className="flex items-center gap-2 px-1 font-medium">
                                <CheckIcon size={18} className="text-success" />
                                {p.centerSet}
                            </p>
                        ) : null}
                        <Button
                            variant="secondary"
                            icon={<PinIcon size={18} className="text-brand" />}
                            onClick={(): void => void locate()}
                        >
                            {p.useMyLocation}
                        </Button>
                    </>
                }
            />
            <p className="px-1 text-sm text-tg-hint">{p.centerHint}</p>
        </div>
    )
}

/** How far the district reaches and how long a network order may wait. */
function RadiusWaitFields({
    form,
    patch,
}: {
    form: DistrictForm
    patch(next: Partial<DistrictForm>): void
}): React.JSX.Element {
    const p = useT().platform
    return (
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
    // A tap beside the sheet or «Back» never throws away what was typed without asking.
    const dirty = JSON.stringify(form) !== JSON.stringify(formOf(district))
    useClosingGuard(dirty)
    const close = async (): Promise<void> => {
        const options = { yes: t.common.leave, no: t.common.stay, destructive: true }
        if (dirty && !(await confirm(p.districtUnsaved, options))) {
            return
        }
        onClose()
    }

    const save = async (): Promise<void> => {
        if (!input) {
            return
        }
        setBusy(true)
        try {
            await adminApi.saveDistrict(district ? input : { ...input, isNew: true })
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
        <Sheet
            title={district ? p.editDistrict : p.addDistrict}
            onClose={(): void => void close()}
            footer={
                <Button
                    size="lg"
                    loading={busy}
                    disabled={input === null}
                    onClick={(): void => void save()}
                >
                    {t.common.save}
                </Button>
            }
        >
            {district ? (
                // The name is the district's key: shown, never edited.
                <p className="px-1 text-lg font-semibold">{district.name}</p>
            ) : (
                <Field label={p.districtName} htmlFor="district-name">
                    <TextInput
                        id="district-name"
                        value={form.name}
                        maxLength={60}
                        placeholder={p.districtNamePlaceholder}
                        onChange={(e): void => patch({ name: e.target.value })}
                    />
                </Field>
            )}
            <RegionField value={form.region} onChange={(region): void => patch({ region })} />
            <CenterField
                value={form.center}
                radiusKm={decimal(form.radius) || 0}
                onChange={(center): void => patch({ center })}
            />
            <RadiusWaitFields form={form} patch={patch} />
            {input === null ? (
                <p className="px-1 text-sm text-tg-hint">
                    {form.region ? p.districtLimits : p.pickRegion}
                </p>
            ) : null}
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

/** The districts by viloyat: a heading with the full name and how many, then their cards. */
function DistrictList({
    districts,
    onEdit,
}: {
    districts: DistrictStats[]
    onEdit(district: DistrictStats): void
}): React.JSX.Element {
    const p = useT().platform
    return (
        <div className="flex flex-col gap-5">
            {byRegion(districts).map((group) => {
                const title = group.region ? regionName(p.regions, group.region) : p.noRegion
                return (
                    <section key={group.region ?? "none"} aria-label={title}>
                        <h2 className="flex items-baseline justify-between gap-3 px-1 pb-2">
                            <span className="text-base font-bold">{title}</span>
                            <span className="shrink-0 text-sm text-tg-hint tabular-nums">
                                {fill(p.regionCount, { n: group.districts.length })}
                            </span>
                        </h2>
                        <ul className="flex flex-col gap-3">
                            {group.districts.map((district) => (
                                <DistrictCard
                                    key={district.id}
                                    district={district}
                                    onEdit={(): void => onEdit(district)}
                                />
                            ))}
                        </ul>
                    </section>
                )
            })}
        </div>
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
        body = <DistrictList districts={districtList} onEdit={setEditing} />
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

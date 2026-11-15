import { useEffect, useRef, useState } from "react"

import { useLanguage, useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { formatMoney } from "../lib/format.js"
import { compressImage } from "../lib/image.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { ImageIcon, PlusIcon } from "../ui/icons.js"
import { ProductImage } from "../ui/product-image.js"
import { Sheet, SheetOption } from "../ui/sheet.js"

import { MAX_PHOTOS, makeMain } from "./photos.js"

import type { PhotoSlot } from "./photos.js"
import type { Category, Unit } from "@zumda/core"

/** Every picked picture as an address the page can show, freed when it leaves the form. */
function useSlotUrls(slots: readonly PhotoSlot[]): Map<string, string> {
    const [urls, setUrls] = useState(new Map<string, string>())
    useEffect(() => {
        const next = new Map<string, string>()
        for (const slot of slots) {
            if ("blob" in slot) {
                next.set(slot.id, URL.createObjectURL(slot.blob))
            }
        }
        setUrls(next)
        return (): void => {
            for (const url of next.values()) {
                URL.revokeObjectURL(url)
            }
        }
    }, [slots])
    return urls
}

/** One photo: the picked file, or the product's own from the storage. */
function SlotImage({
    slot,
    urls,
    category,
}: {
    slot: PhotoSlot
    urls: Map<string, string>
    category: Category
}): React.JSX.Element {
    if ("key" in slot) {
        return (
            <ProductImage
                imageKey={slot.key}
                category={category}
                alt=""
                className="h-full w-full"
            />
        )
    }
    const url = urls.get(slot.id)
    return url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
    ) : (
        <span className="block h-full w-full bg-tg-secondary" />
    )
}

const TILE_FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"

/**
 * Up to three photos (owner's decision, November 2026): a tile each, the first marked «Asosiy»
 * (the menu, the showcase and the catalog show it); a tap offers «Asosiy qilish» and «Rasmni
 * o'chirish»; «Rasm qo'shish» while there is room.
 */
function PhotoStrip({
    slots,
    urls,
    category,
    busy,
    onAdd,
    onChange,
}: {
    slots: readonly PhotoSlot[]
    urls: Map<string, string>
    category: Category
    busy: boolean
    onAdd(): void
    onChange(slots: PhotoSlot[]): void
}): React.JSX.Element {
    const t = useT()
    const p = t.owner.product
    const [open, setOpen] = useState<number | null>(null)
    return (
        <div className="mt-3 px-1">
            <div className="flex gap-2">
                {slots.map((slot, index) => (
                    <button
                        key={"key" in slot ? slot.key : slot.id}
                        type="button"
                        aria-label={`${p.photo} ${index + 1}${index === 0 ? `: ${p.mainPhoto}` : ""}`}
                        onClick={(): void => {
                            haptic.tap()
                            setOpen(index)
                        }}
                        className={cn(
                            "tap relative h-16 w-16 shrink-0 overflow-hidden rounded-control",
                            TILE_FOCUS,
                        )}
                    >
                        <SlotImage slot={slot} urls={urls} category={category} />
                        {index === 0 ? (
                            <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[0.65rem] font-semibold text-white">
                                {p.mainPhoto}
                            </span>
                        ) : null}
                    </button>
                ))}
                {slots.length < MAX_PHOTOS ? (
                    <button
                        type="button"
                        aria-label={p.addPhoto}
                        onClick={onAdd}
                        className={cn(
                            "tap grid h-16 w-16 shrink-0 place-items-center rounded-control border-[1.5px] border-dashed border-brand bg-brand/10 text-brand",
                            TILE_FOCUS,
                            busy && "animate-pulse",
                        )}
                    >
                        <PlusIcon size={22} />
                    </button>
                ) : null}
            </div>
            <p className="mt-1.5 text-sm text-tg-hint">{p.photosHint}</p>
            {open !== null ? (
                <Sheet title={`${p.photo} ${open + 1}`} onClose={(): void => setOpen(null)}>
                    <div className="flex flex-col gap-2">
                        {open > 0 ? (
                            <SheetOption
                                label={p.makeMain}
                                onClick={(): void => {
                                    haptic.select()
                                    onChange(makeMain(slots, open))
                                    setOpen(null)
                                }}
                            />
                        ) : null}
                        <SheetOption
                            label={p.removePhoto}
                            danger
                            onClick={(): void => {
                                haptic.tap()
                                onChange(slots.filter((_, i) => i !== open))
                                setOpen(null)
                            }}
                        />
                    </div>
                </Sheet>
            ) : null}
        </div>
    )
}

/** The preview's picture: the main photo, or a dashed «Rasm» that asks for the first one. */
function MainTile({
    main,
    urls,
    category,
    busy,
    onAdd,
}: {
    main: PhotoSlot | undefined
    urls: Map<string, string>
    category: Category
    busy: boolean
    onAdd(): void
}): React.JSX.Element {
    const p = useT().owner.product
    if (main) {
        return (
            <span className="h-20 w-20 shrink-0 overflow-hidden rounded-tile">
                <SlotImage slot={main} urls={urls} category={category} />
            </span>
        )
    }
    return (
        <button
            type="button"
            aria-label={p.addPhoto}
            onClick={onAdd}
            className={cn(
                "tap grid h-20 w-20 shrink-0 place-items-center rounded-tile border-[1.5px] border-dashed border-brand bg-brand/10 text-brand",
                TILE_FOCUS,
                busy && "animate-pulse",
            )}
        >
            <span className="flex flex-col items-center gap-0.5 text-xs font-semibold">
                <ImageIcon size={24} />
                {p.photo}
            </span>
        </button>
    )
}

/**
 * «Mijoz shunday ko'radi»: the row the customer will see, live as the owner types. Its picture is
 * the main photo, or a dashed «Rasm» that asks for one (the phone offers the camera or the
 * gallery); every photo is under it.
 */
export function ProductPreview({
    name,
    price,
    unit,
    category,
    priceFrom,
    photos,
    onPhotos,
}: {
    name: string
    price: number | null
    unit: Unit
    category: Category
    /** Variants with different prices: «… so'm dan». */
    priceFrom: boolean
    photos: PhotoSlot[]
    onPhotos(photos: PhotoSlot[]): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const p = t.owner.product
    const input = useRef<HTMLInputElement>(null)
    const urls = useSlotUrls(photos)
    const [busy, setBusy] = useState(false)
    const units = t.units as Record<string, string>
    const main = photos[0]

    const pick = async (file: File | undefined): Promise<void> => {
        if (!file) {
            return
        }
        setBusy(true)
        try {
            const blob = await compressImage(file)
            onPhotos([...photos, { blob, id: crypto.randomUUID() }].slice(0, MAX_PHOTOS))
        } catch {
            toast(p.photoFailed, "error")
        } finally {
            setBusy(false)
        }
    }
    const add = (): void => {
        haptic.tap()
        input.current?.click()
    }

    return (
        <section className="rounded-tile bg-tg-secondary p-3">
            <p className="mb-2 px-1 text-sm font-semibold text-tg-hint">{p.preview}</p>
            <div className="flex items-center gap-3 rounded-control bg-tg-bg p-2.5">
                <MainTile main={main} urls={urls} category={category} busy={busy} onAdd={add} />
                <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-medium leading-snug">
                        {name.trim() || p.namePlaceholder}
                    </p>
                    <p className="text-sm">
                        <span className="font-semibold">{formatMoney(price ?? 0, language)}</span>
                        <span className="text-tg-hint">
                            {priceFrom ? ` ${t.shop.from}` : ` / ${units[unit] ?? unit}`}
                        </span>
                    </p>
                </div>
            </div>
            {photos.length > 0 ? (
                <PhotoStrip
                    slots={photos}
                    urls={urls}
                    category={category}
                    busy={busy}
                    onAdd={add}
                    onChange={onPhotos}
                />
            ) : null}
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
        </section>
    )
}

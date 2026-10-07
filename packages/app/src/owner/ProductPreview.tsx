import { useEffect, useRef, useState } from "react"

import { useLanguage, useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { formatMoney } from "../lib/format.js"
import { compressImage } from "../lib/image.js"
import { toast } from "../stores/toast.js"
import { ImageIcon, PlusIcon } from "../ui/icons.js"
import { ProductImage } from "../ui/product-image.js"

import type { Category, ProductDTO, Unit } from "@zumda/core"

export type PhotoDraft = Blob | "remove" | null

/** The picked picture as an address the page can show, freed when it changes. */
function usePhotoUrl(photo: PhotoDraft): string | null {
    const [url, setUrl] = useState<string | null>(null)
    useEffect(() => {
        if (!(photo instanceof Blob)) {
            setUrl(null)
            return undefined
        }
        const next = URL.createObjectURL(photo)
        setUrl(next)
        return (): void => URL.revokeObjectURL(next)
    }, [photo])
    return url
}

/** The picture of the preview: the photo, or a dashed «Rasm» that asks for one. */
function PhotoTile({
    url,
    current,
    category,
    busy,
    onClick,
}: {
    url: string | null
    current: string | undefined
    category: Category
    busy: boolean
    onClick(): void
}): React.JSX.Element {
    const t = useT()
    const p = t.owner.product
    const hasPhoto = url !== null || current !== undefined
    return (
        <button
            type="button"
            aria-label={hasPhoto ? p.changePhoto : p.addPhoto}
            onClick={onClick}
            className={cn(
                "tap relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-tile",
                !hasPhoto && "border-[1.5px] border-dashed border-brand bg-brand/10 text-brand",
                busy && "animate-pulse",
            )}
        >
            {url ? (
                <img src={url} alt="" className="h-full w-full object-cover" />
            ) : hasPhoto ? (
                <ProductImage
                    imageKey={current}
                    category={category}
                    alt=""
                    className="h-full w-full"
                />
            ) : (
                <span className="flex flex-col items-center gap-0.5 text-xs font-semibold">
                    <ImageIcon size={24} />
                    {p.photo}
                </span>
            )}
        </button>
    )
}

/**
 * «Mijoz shunday ko'radi»: the row the customer will see, live as the owner types. Its picture is
 * the photo button (the phone offers the camera or the gallery).
 */
export function ProductPreview({
    product,
    name,
    price,
    unit,
    category,
    priceFrom,
    photo,
    onPhoto,
}: {
    product: ProductDTO | undefined
    name: string
    price: number | null
    unit: Unit
    category: Category
    /** Variants with different prices: «… so'm dan». */
    priceFrom: boolean
    photo: PhotoDraft
    onPhoto(photo: PhotoDraft): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const p = t.owner.product
    const input = useRef<HTMLInputElement>(null)
    const url = usePhotoUrl(photo)
    const [busy, setBusy] = useState(false)
    const current = photo === "remove" ? undefined : product?.imageKey
    const hasPhoto = url !== null || current !== undefined
    const units = t.units as Record<string, string>

    const pick = async (file: File | undefined): Promise<void> => {
        if (!file) {
            return
        }
        setBusy(true)
        try {
            onPhoto(await compressImage(file))
        } catch {
            toast(p.photoFailed, "error")
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="rounded-tile bg-tg-secondary p-3">
            <p className="mb-2 px-1 text-sm font-semibold text-tg-hint">{p.preview}</p>
            <div className="flex items-center gap-3 rounded-control bg-tg-bg p-2.5">
                <PhotoTile
                    url={url}
                    current={current}
                    category={category}
                    busy={busy}
                    onClick={(): void => input.current?.click()}
                />
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
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                    <PlusIcon size={22} strokeWidth={2.25} />
                </span>
            </div>
            {hasPhoto ? (
                <button
                    type="button"
                    onClick={(): void => onPhoto(current ? "remove" : null)}
                    className="tap mt-1 min-h-11 px-1 text-sm font-medium text-tg-destructive"
                >
                    {p.removePhoto}
                </button>
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

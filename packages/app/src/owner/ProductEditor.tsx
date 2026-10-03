import {
    CATEGORIES,
    DEFAULT_KG_STEP,
    Feature,
    GRAMS_PER_KG,
    SUGGESTED_CATEGORIES,
    SUGGESTED_UNITS,
    UNITS,
    Unit,
} from "@zumda/core"
import { useEffect, useRef, useState } from "react"

import { errorText, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { guessCategory } from "../lib/category-guess.js"
import { cn } from "../lib/cn.js"
import { formatQuantity } from "../lib/format.js"
import { compressImage } from "../lib/image.js"
import { useMainAction } from "../lib/main-button.js"
import { confirm, haptic } from "../lib/telegram.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { ImageIcon, TrashIcon } from "../ui/icons.js"
import {
    Button,
    Field,
    MoneyInput,
    Section,
    Skeleton,
    Switch,
    TextArea,
    TextInput,
} from "../ui/primitives.js"
import { ProductImage } from "../ui/product-image.js"
import { BottomSpacer } from "../ui/shell.js"

import { useOwner } from "./store.js"

import type { ProductInput } from "../lib/api.js"
import type { BusinessType, Category, ProductDTO } from "@zumda/core"

/** Selling steps offered for weight items, in grams. */
const KG_STEPS = [100, 250, 500, GRAMS_PER_KG] as const

interface Draft {
    name: string
    description: string
    price: number | null
    unit: Unit
    category: Category
    /** Selling step in grams; used only for kg. */
    step: number
    returnable: boolean
    isAvailable: boolean
    /** New photo picked on this screen, or "remove" to drop the current one. */
    photo: Blob | "remove" | null
    /** The owner chose the category: the name no longer moves it. */
    categoryPicked?: boolean
}

/** A new product starts with the first unit and category that fit the shop, so it rarely needs a tap. */
function newDraft(type: BusinessType | undefined): Draft {
    const unit = (type && SUGGESTED_UNITS[type][0]) || Unit.PIECE
    return {
        name: "",
        description: "",
        price: null,
        unit,
        category: (type && SUGGESTED_CATEGORIES[type][0]) || "other",
        step: DEFAULT_KG_STEP,
        returnable: unit === Unit.BOTTLE_19L,
        isAvailable: true,
        photo: null,
    }
}

function draftOf(product: ProductDTO | undefined, type: BusinessType | undefined): Draft {
    if (!product) {
        return newDraft(type)
    }
    return {
        name: product.name,
        description: product.description ?? "",
        price: product.price,
        unit: product.unit,
        category: product.category,
        step: product.unit === Unit.KG ? product.step : DEFAULT_KG_STEP,
        returnable: product.returnable,
        isAvailable: product.isAvailable,
        photo: null,
    }
}

function Chips<T extends string>({
    value,
    options,
    label,
    onChange,
}: {
    value: T
    options: readonly T[]
    label(option: T): string
    onChange(value: T): void
}): React.JSX.Element {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map((option) => (
                <button
                    key={option}
                    type="button"
                    aria-pressed={option === value}
                    onClick={(): void => {
                        haptic.select()
                        onChange(option)
                    }}
                    className={cn(
                        "tap h-11 rounded-full px-3.5 text-sm font-medium transition-colors duration-200",
                        option === value ? "bg-brand text-brand-ink" : "bg-tg-secondary",
                    )}
                >
                    {label(option)}
                </button>
            ))}
        </div>
    )
}

function PhotoPicker({
    product,
    draft,
    onChange,
}: {
    product: ProductDTO | undefined
    draft: Draft
    onChange(photo: Draft["photo"]): void
}): React.JSX.Element {
    const t = useT()
    const input = useRef<HTMLInputElement>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!(draft.photo instanceof Blob)) {
            setPreview(null)
            return undefined
        }
        const url = URL.createObjectURL(draft.photo)
        setPreview(url)
        return (): void => URL.revokeObjectURL(url)
    }, [draft.photo])

    const pick = async (file: File | undefined): Promise<void> => {
        if (!file) {
            return
        }
        setBusy(true)
        try {
            onChange(await compressImage(file))
        } catch {
            toast(t.owner.product.photoFailed, "error")
        } finally {
            setBusy(false)
        }
    }

    const current = draft.photo === "remove" ? undefined : product?.imageKey
    const hasPhoto = preview !== null || current !== undefined
    return (
        <div className="flex items-center gap-4">
            {preview ? (
                <img src={preview} alt="" className="h-24 w-24 rounded-tile object-cover" />
            ) : (
                <ProductImage
                    imageKey={current}
                    category={draft.category}
                    alt=""
                    className="h-24 w-24 shrink-0 rounded-tile"
                />
            )}
            <div className="flex flex-col items-start gap-2">
                <Button
                    variant="secondary"
                    icon={<ImageIcon size={18} />}
                    loading={busy}
                    onClick={(): void => input.current?.click()}
                >
                    {hasPhoto ? t.owner.product.changePhoto : t.owner.product.addPhoto}
                </Button>
                {hasPhoto ? (
                    <button
                        type="button"
                        onClick={(): void => onChange(current ? "remove" : null)}
                        className="tap px-1 text-sm font-medium text-tg-destructive"
                    >
                        {t.owner.product.removePhoto}
                    </button>
                ) : null}
            </div>
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

/** Creates or updates the product's fields. */
async function saveFields(product: ProductDTO | undefined, draft: Draft): Promise<ProductDTO> {
    const input: ProductInput = {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        price: draft.price ?? 0,
        unit: draft.unit,
        category: draft.category,
        returnable: draft.returnable,
        ...(draft.unit === Unit.KG ? { step: draft.step } : {}),
    }
    if (!product) {
        return api.owner.createProduct(input)
    }
    return api.owner.updateProduct(product.id, {
        ...input,
        description: input.description ?? null,
        // Sent only when changed: showing a product again also clears today's stop-list mark.
        ...(draft.isAvailable !== product.isAvailable ? { isAvailable: draft.isAvailable } : {}),
    })
}

async function savePhoto(product: ProductDTO, photo: Draft["photo"]): Promise<ProductDTO> {
    if (photo instanceof Blob) {
        return api.owner.uploadProductImage(product.id, photo)
    }
    if (photo === "remove" && product.imageKey) {
        return api.owner.removeProductImage(product.id)
    }
    return product
}

function useEditor(id: string | null): {
    product: ProductDTO | undefined
    loading: boolean
} {
    const products = useOwner((state) => state.products)
    const loadProducts = useOwner((state) => state.loadProducts)
    useEffect(() => {
        if (products === null) {
            loadProducts().catch(() => undefined)
        }
    }, [products, loadProducts])
    return {
        product: id ? products?.find((p) => p.id === id) : undefined,
        loading: id !== null && products === null,
    }
}

export function ProductEditor({ id }: { id: string | null }): React.JSX.Element {
    const { product, loading } = useEditor(id)
    if (loading) {
        return (
            <div className="flex flex-col gap-4 px-4 pt-4">
                <Skeleton className="h-24 w-24 rounded-tile" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
            </div>
        )
    }
    return <EditorForm key={product?.id ?? "new"} product={product} />
}

function ProductExtras({
    product,
    available,
    onAvailable,
    onError,
}: {
    product: ProductDTO
    available: boolean
    onAvailable(value: boolean): void
    onError(caught: unknown): void
}): React.JSX.Element {
    const t = useT()
    const back = useRouter((state) => state.back)
    const drop = useOwner((state) => state.drop)
    const remove = async (): Promise<void> => {
        if (!(await confirm(t.owner.product.deleteConfirm))) {
            return
        }
        try {
            await api.owner.deleteProduct(product.id)
            drop(product.id)
            haptic.success()
            back()
        } catch (caught) {
            onError(caught)
        }
    }
    return (
        <>
            <label className="flex items-center justify-between gap-3 rounded-control bg-tg-secondary px-4 py-3">
                <span className="font-medium">{t.owner.product.available}</span>
                <Switch
                    checked={available}
                    onChange={onAvailable}
                    label={t.owner.product.available}
                />
            </label>
            <Button
                variant="danger"
                icon={<TrashIcon size={18} />}
                onClick={(): void => void remove()}
            >
                {t.common.delete}
            </Button>
        </>
    )
}

/** The shop's own units first; a unit set earlier stays visible even if it is not suggested. */
function unitOptions(type: BusinessType | undefined, current: Unit): readonly Unit[] {
    const suggested = type ? SUGGESTED_UNITS[type] : UNITS
    return suggested.includes(current) ? suggested : [...suggested, current]
}

/** Four at most: what the name suggests, then the shop's usual ones; the current one stays. */
const LIKELY_CATEGORIES = 4

function likelyCategories(
    name: string,
    suggested: readonly Category[],
    value: Category,
): Category[] {
    const guess = guessCategory(name)
    const likely = [...new Set([...(guess ? [guess] : []), ...suggested])].slice(
        0,
        LIKELY_CATEGORIES,
    )
    return likely.includes(value) ? likely : [value, ...likely.slice(0, LIKELY_CATEGORIES - 1)]
}

function CategoryField({
    value,
    name,
    onChange,
}: {
    value: Category
    name: string
    onChange(category: Category): void
}): React.JSX.Element {
    const t = useT()
    const type = useSession((state) => state.shop?.type)
    const suggested = type ? SUGGESTED_CATEGORIES[type] : CATEGORIES
    const [all, setAll] = useState(false)
    const categories = t.categories as Record<string, string>
    return (
        <Section title={t.owner.product.category}>
            <Chips
                value={value}
                options={all ? CATEGORIES : likelyCategories(name, suggested, value)}
                label={(c): string => categories[c] ?? c}
                onChange={onChange}
            />
            {all ? null : (
                <button
                    type="button"
                    onClick={(): void => setAll(true)}
                    className="tap self-start px-1 py-2 text-sm font-medium text-tg-link"
                >
                    {t.owner.product.moreCategories}
                </button>
            )}
        </Section>
    )
}

/** Unit, weight step, returnable bottle and category: tap a chip, no dropdowns. */
function KindFields({
    draft,
    patch,
}: {
    draft: Draft
    patch(change: Partial<Draft>): void
}): React.JSX.Element {
    const t = useT()
    const shop = useSession((state) => state.shop)
    const units = t.units as Record<string, string>
    const deposit = shop?.features.includes(Feature.BOTTLE_DEPOSIT) ?? false
    return (
        <>
            <Section title={t.owner.product.unit}>
                <Chips
                    value={draft.unit}
                    options={unitOptions(shop?.type, draft.unit)}
                    label={(u): string => units[u] ?? u}
                    onChange={(unit): void => patch({ unit })}
                />
            </Section>
            {draft.unit === Unit.KG ? (
                <Section title={t.owner.product.step}>
                    <Chips
                        value={String(draft.step)}
                        options={KG_STEPS.map(String)}
                        label={(g): string => formatQuantity(Number(g), Unit.KG, t.units.kg)}
                        onChange={(g): void => patch({ step: Number(g) })}
                    />
                </Section>
            ) : null}
            {deposit || draft.returnable ? (
                <label className="flex items-center justify-between gap-3 rounded-control bg-tg-secondary px-4 py-3">
                    <span>
                        <span className="block font-medium">{t.owner.product.returnable}</span>
                        <span className="block text-sm text-tg-hint">
                            {t.owner.product.returnableHint}
                        </span>
                    </span>
                    <Switch
                        checked={draft.returnable}
                        onChange={(returnable): void => patch({ returnable })}
                        label={t.owner.product.returnable}
                    />
                </label>
            ) : null}
            <CategoryField
                value={draft.category}
                name={draft.name}
                onChange={(category): void => patch({ category, categoryPicked: true })}
            />
        </>
    )
}

function EditorForm({ product: initial }: { product: ProductDTO | undefined }): React.JSX.Element {
    const t = useT()
    const back = useRouter((state) => state.back)
    const shopType = useSession((state) => state.shop?.type)
    const upsert = useOwner((state) => state.upsert)
    const [draft, setDraft] = useState<Draft>(() => draftOf(initial, shopType))
    // Once created, the product exists: a retry after a failed photo upload must not create it again.
    const [product, setProduct] = useState(initial)
    const [saving, setSaving] = useState(false)
    const patch = (change: Partial<Draft>): void => setDraft((d) => ({ ...d, ...change }))
    const valid = draft.name.trim().length > 0 && (draft.price ?? 0) > 0

    const fail = (caught: unknown): void => {
        haptic.error()
        toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
    }

    const save = async (): Promise<void> => {
        if (saving) {
            return
        }
        setSaving(true)
        try {
            const fields = await saveFields(product, draft)
            setProduct(fields)
            upsert(fields)
            upsert(await savePhoto(fields, draft.photo))
            haptic.success()
            toast(t.owner.settings.saved, "success")
            back()
        } catch (caught) {
            fail(caught)
        } finally {
            setSaving(false)
        }
    }

    useMainAction({
        text: saving ? t.common.saving : t.common.save,
        onClick: (): void => void save(),
        loading: saving,
        disabled: !valid,
    })

    return (
        <main className="flex flex-col gap-6 px-4 pt-4">
            <h1 className="text-2xl font-bold">
                {product ? t.owner.product.edit : t.owner.product.new}
            </h1>
            <PhotoPicker
                product={product}
                draft={draft}
                onChange={(photo): void => patch({ photo })}
            />
            <Field label={t.owner.product.name} htmlFor="product-name">
                <TextInput
                    id="product-name"
                    value={draft.name}
                    maxLength={80}
                    onChange={(e): void => {
                        const name = e.target.value
                        // A new product follows its name until the owner picks a category.
                        const guess = product || draft.categoryPicked ? null : guessCategory(name)
                        patch(guess ? { name, category: guess } : { name })
                    }}
                />
            </Field>
            <Field
                label={draft.unit === Unit.KG ? t.owner.product.pricePerKg : t.owner.product.price}
                htmlFor="product-price"
                hint={t.owner.product.priceHint}
            >
                <MoneyInput
                    id="product-price"
                    value={draft.price}
                    onChange={(price): void => patch({ price })}
                />
            </Field>
            <KindFields draft={draft} patch={patch} />
            <Field label={t.owner.product.description} htmlFor="product-description">
                <TextArea
                    id="product-description"
                    value={draft.description}
                    maxLength={500}
                    onChange={(e): void => patch({ description: e.target.value })}
                />
            </Field>
            {product ? (
                <ProductExtras
                    product={product}
                    available={draft.isAvailable}
                    onAvailable={(isAvailable): void => patch({ isAvailable })}
                    onError={fail}
                />
            ) : null}
            <BottomSpacer />
        </main>
    )
}

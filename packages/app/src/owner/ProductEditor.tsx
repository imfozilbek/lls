import {
    CATEGORIES,
    CATEGORY_GROUPS,
    Feature,
    SHELF_OF,
    SUGGESTED_CATEGORIES,
    SUGGESTED_UNITS,
    UNITS,
    Unit,
    categoriesOf,
    defaultStep,
    isBottleUnit,
    isWeightUnit,
} from "@zumda/core"
import { useEffect, useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { guessCategory } from "../lib/category-guess.js"
import { cn } from "../lib/cn.js"
import { formatQuantity } from "../lib/format.js"
import { useBackButton, useClosingGuard, useMainAction } from "../lib/main-button.js"
import { confirm, haptic } from "../lib/telegram.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { CheckIcon, CopyIcon, ListIcon, PlusIcon, SearchIcon, TrashIcon } from "../ui/icons.js"
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
import { BottomSpacer } from "../ui/shell.js"

import { CatalogSearch } from "./CatalogSearch.js"
import {
    NO_OPTIONS,
    OptionsEditor,
    newId,
    hasVariants,
    optionsBody,
    optionsDraftOf,
    optionsValid,
} from "./OptionsEditor.js"
import { ProductPreview } from "./ProductPreview.js"
import { useOwner } from "./store.js"

import type { OptionsDraft } from "./OptionsEditor.js"
import type { Template } from "./catalog.js"
import type { ProductInput } from "../lib/api.js"
import type { BusinessType, Category, ProductDTO, ProductOptionsProps } from "@zumda/core"

/** Selling steps offered for weight items, in grams: by the kilo, by 100 g, by the gram. */
const WEIGHT_STEPS: Partial<Record<Unit, readonly number[]>> = {
    [Unit.KG]: [100, 250, 500, 1000],
    [Unit.G100]: [50, 100, 250, 500],
    [Unit.GRAM]: [1, 5, 10, 50],
}

/** «Narxi» for pieces, «1 kg narxi», «100 g narxi», «1 m² narxi» for what is measured. */
function priceLabel(unit: Unit, t: ReturnType<typeof useT>): string {
    if (unit === Unit.PIECE || unit === Unit.PORTION || isBottleUnit(unit)) {
        return t.owner.product.price
    }
    const word = (t.units as Record<string, string>)[unit] ?? unit
    return fill(t.owner.product.priceFor, { unit: unit === Unit.G100 ? word : `1 ${word}` })
}

/** A new unit keeps a weight step that still fits it, otherwise starts from its own. */
function stepFor(unit: Unit, step: number): number {
    return WEIGHT_STEPS[unit]?.includes(step) ? step : defaultStep(unit)
}

interface Draft {
    name: string
    description: string
    price: number | null
    unit: Unit
    category: Category
    /** Selling step in grams; used only for weight units. */
    step: number
    returnable: boolean
    isAvailable: boolean
    /** New photo picked on this screen, or "remove" to drop the current one. */
    photo: Blob | "remove" | null
    /** The owner chose the category: the name no longer moves it. */
    categoryPicked?: boolean
    /** Variants and add-ons as they are typed. */
    options: OptionsDraft
    /** Add-ons people usually take with the catalog product picked: offered, never added. */
    suggestedAddons?: string[]
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
        step: defaultStep(unit),
        returnable: isBottleUnit(unit),
        isAvailable: true,
        photo: null,
        options: NO_OPTIONS,
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
        step: isWeightUnit(product.unit) ? product.step : defaultStep(product.unit),
        returnable: product.returnable,
        isAvailable: product.isAvailable,
        photo: null,
        options: optionsDraftOf(product.options),
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

/** With variants the product costs as its cheapest one; the server checks it again. */
function priceOf(draft: Draft): number {
    const body = optionsBody(draft.options)
    const lowest = body?.variants.length ? Math.min(...body.variants.map((v) => v.price)) : null
    return lowest ?? draft.price ?? 0
}

/** Variants and add-ons for the API; a weight item drops its add-ons (it sells by the gram). */
function optionsFor(draft: Draft): ProductOptionsProps | null {
    const options = isWeightUnit(draft.unit) ? { ...draft.options, addons: [] } : draft.options
    return optionsBody(options)
}

async function saveFields(product: ProductDTO | undefined, draft: Draft): Promise<ProductDTO> {
    const options = optionsFor(draft)
    const input: ProductInput = {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        price: priceOf(draft),
        unit: draft.unit,
        category: draft.category,
        returnable: draft.returnable,
        ...(isWeightUnit(draft.unit) ? { step: draft.step } : {}),
    }
    if (!product) {
        return api.owner.createProduct(options ? { ...input, options } : input)
    }
    return api.owner.updateProduct(product.id, {
        ...input,
        // null drops the variants and add-ons the product had.
        options,
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

/** «Nusxa olish»: a new product starting from another one, without its photo. */
function useCopy(product: ProductDTO | undefined): ProductDTO | undefined {
    const [copy] = useState(() => (product ? null : useOwner.getState().copyOf))
    useEffect(() => {
        useOwner.getState().copyProduct(null)
    }, [])
    return copy ?? undefined
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
    const push = useRouter((state) => state.push)
    const drop = useOwner((state) => state.drop)
    const copyProduct = useOwner((state) => state.copyProduct)
    const remove = async (): Promise<void> => {
        const options = { yes: t.common.delete, destructive: true }
        if (!(await confirm(t.owner.product.deleteConfirm, options))) {
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
                variant="secondary"
                icon={<CopyIcon size={18} />}
                onClick={(): void => {
                    haptic.tap()
                    copyProduct(product)
                    push({ name: "product", id: null })
                }}
            >
                {t.owner.product.copy}
            </Button>
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
function unitOptions(type: BusinessType | undefined, current: Unit, all: boolean): readonly Unit[] {
    if (all) {
        return UNITS
    }
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

/** Every category, shelf by shelf, the shop's own shelf first: no wall of 100 chips. */
function AllCategories({
    value,
    onChange,
}: {
    value: Category
    onChange(category: Category): void
}): React.JSX.Element {
    const t = useT()
    const type = useSession((state) => state.shop?.type)
    const categories = t.categories as Record<string, string>
    const own = type ? SHELF_OF[type] : undefined
    const shelves = own ? [own, ...CATEGORY_GROUPS.filter((g) => g !== own)] : CATEGORY_GROUPS
    return (
        <div className="flex flex-col gap-4">
            {shelves.map((group) => (
                <div key={group} className="flex flex-col gap-2">
                    <h3 className="px-1 text-sm font-semibold text-tg-hint">
                        {t.owner.product.groups[group]}
                    </h3>
                    <Chips
                        value={value}
                        options={categoriesOf(group)}
                        label={(c): string => categories[c] ?? c}
                        onChange={onChange}
                    />
                </div>
            ))}
        </div>
    )
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
            {all ? (
                <AllCategories value={value} onChange={onChange} />
            ) : (
                <>
                    <Chips
                        value={value}
                        options={likelyCategories(name, suggested, value)}
                        label={(c): string => categories[c] ?? c}
                        onChange={onChange}
                    />
                    <button
                        type="button"
                        onClick={(): void => setAll(true)}
                        className="tap self-start px-1 py-2 text-sm font-medium text-brand"
                    >
                        {t.owner.product.moreCategories}
                    </button>
                </>
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
    const [allUnits, setAllUnits] = useState(false)
    const steps = WEIGHT_STEPS[draft.unit]
    return (
        <>
            <Section title={t.owner.product.unit}>
                <Chips
                    value={draft.unit}
                    options={unitOptions(shop?.type, draft.unit, allUnits)}
                    label={(u): string => units[u] ?? u}
                    onChange={(unit): void =>
                        patch({
                            unit,
                            step: stepFor(unit, draft.step),
                            ...(isBottleUnit(unit) ? { returnable: true } : {}),
                        })
                    }
                />
                {allUnits ? null : (
                    <button
                        type="button"
                        onClick={(): void => setAllUnits(true)}
                        className="tap self-start px-1 py-2 text-sm font-medium text-brand"
                    >
                        {t.owner.product.moreUnits}
                    </button>
                )}
            </Section>
            {steps ? (
                <Section title={t.owner.product.step}>
                    <Chips
                        value={String(draft.step)}
                        options={steps.map(String)}
                        label={(g): string => formatQuantity(Number(g), draft.unit, units)}
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

/** The price, or a word that it lives in the variants (the cheapest one is shown). */
function PriceField({
    draft,
    patch,
    error,
}: {
    draft: Draft
    patch(change: Partial<Draft>): void
    error: boolean
}): React.JSX.Element {
    const t = useT()
    if (hasVariants(draft.options)) {
        return <p className="px-1 text-sm text-tg-hint">{t.owner.product.priceInVariants}</p>
    }
    return (
        <Field
            label={priceLabel(draft.unit, t)}
            htmlFor="product-price"
            hint={
                error ? (
                    <span className="text-tg-destructive">{t.owner.product.needPrice}</span>
                ) : (
                    t.owner.product.priceHint
                )
            }
        >
            <MoneyInput
                id="product-price"
                value={draft.price}
                onChange={(price): void => patch({ price })}
            />
        </Field>
    )
}

/** What makes a draft worth guarding: everything but the photo, which counts once picked. */
function fingerprint(draft: Draft): string {
    const { photo, suggestedAddons: _offered, categoryPicked: _picked, ...rest } = draft
    return JSON.stringify({ ...rest, photo: photo === null ? null : "changed" })
}

/** The template's words, unit, step and variants (their prices are the owner's). */
function fromTemplate(draft: Draft, template: Template): Draft {
    const variants = template.variants.length >= 2 ? template.variants : []
    return {
        ...draft,
        name: template.name,
        category: template.category,
        categoryPicked: true,
        unit: template.unit,
        step: template.step ?? defaultStep(template.unit),
        returnable: isBottleUnit(template.unit),
        options: {
            group: variants.length > 0 ? (template.group ?? "") : "",
            variants: variants.map((name) => ({ id: newId(), name, price: null })),
            addons: [],
        },
        suggestedAddons: template.addons,
    }
}

/** What is missing, in the order the owner fills the form; null when it can be saved. */
function missing(draft: Draft): "name" | "variants" | "price" | null {
    if (draft.name.trim().length === 0) {
        return "name"
    }
    if (!optionsValid(draft.options)) {
        return "variants"
    }
    return hasVariants(draft.options) || (draft.price ?? 0) > 0 ? null : "price"
}

/** Never a dead button: a tap says what is missing and marks the field. */
function useSaveAction(input: {
    draft: Draft
    saving: boolean
    onMissing(): void
    save(): Promise<void>
}): void {
    const t = useT()
    const { draft, saving, onMissing, save } = input
    const p = t.owner.product
    useMainAction({
        text: saving ? t.common.saving : t.common.save,
        onClick: (): void => {
            const gap = missing(draft)
            if (!gap) {
                void save()
                return
            }
            haptic.error()
            onMissing()
            toast({ name: p.needName, variants: p.needVariants, price: p.needPrice }[gap], "error")
        },
        loading: saving,
    })
}

/** Leaving with changes asks first; closing the app warns too. */
function useDraftGuard(dirty: boolean): void {
    const t = useT()
    const back = useRouter((state) => state.back)
    useClosingGuard(dirty)
    useBackButton(
        dirty
            ? (): void => {
                  const options = { yes: t.common.leave, no: t.common.stay, destructive: true }
                  void confirm(t.owner.product.unsavedLeave, options).then((leave) => {
                      if (leave) {
                          back()
                      }
                  })
              }
            : null,
    )
}

function useEditorState(initial: ProductDTO | undefined): {
    draft: Draft
    patch(change: Partial<Draft>): void
    restart(next: Draft): void
    dirty: boolean
    copy: ProductDTO | undefined
} {
    const shopType = useSession((state) => state.shop?.type)
    const copy = useCopy(initial)
    const [start, setStart] = useState<Draft>(() =>
        copy ? { ...draftOf(copy, shopType), isAvailable: true } : draftOf(initial, shopType),
    )
    const [draft, setDraft] = useState<Draft>(start)
    return {
        draft,
        patch: (change): void => setDraft((d) => ({ ...d, ...change })),
        restart: (next): void => {
            setStart(next)
            setDraft(next)
        },
        dirty: fingerprint(draft) !== fingerprint(start),
        copy,
    }
}

function Description({
    value,
    onChange,
}: {
    value: string
    onChange(value: string): void
}): React.JSX.Element {
    const t = useT()
    const p = t.owner.product
    const [open, setOpen] = useState(value.length > 0)
    if (!open) {
        return (
            <button
                type="button"
                onClick={(): void => setOpen(true)}
                className="tap flex items-center gap-3 rounded-tile border-[1.5px] border-dashed border-tg-separator p-3.5 text-left"
            >
                <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.description}</span>
                    <span className="block text-sm text-tg-hint">{p.descriptionHint}</span>
                </span>
                <PlusIcon size={20} className="shrink-0 text-tg-hint" />
            </button>
        )
    }
    return (
        <Field label={p.description} htmlFor="product-description">
            <TextArea
                id="product-description"
                value={value}
                maxLength={500}
                placeholder={p.descriptionHint}
                onChange={(e): void => onChange(e.target.value)}
            />
        </Field>
    )
}

function NameField({
    draft,
    product,
    error,
    patch,
}: {
    draft: Draft
    product: ProductDTO | undefined
    error: boolean
    patch(change: Partial<Draft>): void
}): React.JSX.Element {
    const t = useT()
    return (
        <Field
            label={t.owner.product.name}
            htmlFor="product-name"
            hint={
                error ? (
                    <span className="text-tg-destructive">{t.owner.product.needName}</span>
                ) : undefined
            }
        >
            <TextInput
                id="product-name"
                value={draft.name}
                maxLength={80}
                placeholder={t.owner.product.namePlaceholder}
                onChange={(e): void => {
                    const name = e.target.value
                    // A new product follows its name until the owner picks a category.
                    const guess = product || draft.categoryPicked ? null : guessCategory(name)
                    patch(guess ? { name, category: guess } : { name })
                }}
            />
        </Field>
    )
}

/** Saves the draft; `next` keeps the screen for one more product of the same unit and category. */
function useSave(input: {
    draft: Draft
    product: ProductDTO | undefined
    saving: boolean
    setSaving(saving: boolean): void
    restart(next: Draft): void
    onSaved(): void
    onMissing(): void
    /** The product once it exists: a retry after a failed photo updates it, never adds a twin. */
    remember(product: ProductDTO): void
}): (next?: boolean) => Promise<void> {
    const t = useT()
    const back = useRouter((state) => state.back)
    const shopType = useSession((state) => state.shop?.type)
    const upsert = useOwner((state) => state.upsert)
    const { draft, product, saving, setSaving, restart, onSaved, onMissing, remember } = input
    return async (next = false): Promise<void> => {
        if (saving || missing(draft)) {
            onMissing()
            return
        }
        setSaving(true)
        try {
            const fields = await saveFields(product, draft)
            upsert(fields)
            remember(fields)
            upsert(await savePhoto(fields, draft.photo))
            haptic.success()
            toast(t.owner.settings.saved, "success")
            if (!next) {
                restart(draft)
                back()
                return
            }
            // The next one starts where this one was: same unit and category, the search open.
            restart({
                ...newDraft(shopType),
                unit: draft.unit,
                step: draft.step,
                category: draft.category,
            })
            onSaved()
            window.scrollTo({ top: 0 })
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setSaving(false)
        }
    }
}

/** «Ro'yxat bilan»: many products at once, one a line (goal 17). */
function BulkLink(): React.JSX.Element {
    const t = useT()
    const push = useRouter((state) => state.push)
    return (
        <button
            type="button"
            onClick={(): void => push({ name: "bulk" })}
            className="tap flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand/10 px-3 text-sm font-semibold text-brand active:bg-brand/20"
        >
            <ListIcon size={16} />
            {t.owner.product.bulkShort}
        </button>
    )
}

function EditorForm({ product: initial }: { product: ProductDTO | undefined }): React.JSX.Element {
    const t = useT()
    const { draft, patch, restart, dirty, copy } = useEditorState(initial)
    // Once created, the product exists: a retry after a failed photo upload must not create it again.
    const [product, setProduct] = useState(initial)
    const [saving, setSaving] = useState(false)
    const [searching, setSearching] = useState(!initial && !copy)
    const [tried, setTried] = useState(false)
    useDraftGuard(dirty && !saving)

    const save = useSave({
        draft,
        product,
        saving,
        setSaving,
        restart,
        onSaved: (): void => {
            setProduct(undefined)
            setSearching(true)
            setTried(false)
        },
        onMissing: (): void => setTried(true),
        remember: setProduct,
    })

    useSaveAction({ draft, saving, onMissing: () => setTried(true), save })
    const gap = tried ? missing(draft) : null

    return (
        <main className="flex flex-col gap-6 px-4 pt-4">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">
                    {product ? t.owner.product.edit : t.owner.product.new}
                </h1>
                {!product && !searching && draft.categoryPicked && draft.suggestedAddons ? (
                    <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-sm font-semibold text-brand">
                        <CheckIcon size={14} />
                        {t.owner.product.fromCatalog}
                    </span>
                ) : null}
                {!product && searching ? <BulkLink /> : null}
            </div>
            {searching ? (
                <CatalogSearch
                    onPick={(template): void => {
                        restart(draft)
                        patch(fromTemplate(draft, template))
                        setSearching(false)
                    }}
                    onOwn={(name): void => {
                        patch({ name, ...(draft.categoryPicked ? {} : nameGuess(name)) })
                        setSearching(false)
                    }}
                />
            ) : (
                <EditorFields
                    draft={draft}
                    product={product}
                    gap={gap}
                    patch={patch}
                    onSearch={product ? undefined : (): void => setSearching(true)}
                    onSaveNext={product ? undefined : (): void => void save(true)}
                    saving={saving}
                />
            )}
            {product ? (
                <ProductExtras
                    product={product}
                    available={draft.isAvailable}
                    onAvailable={(isAvailable): void => patch({ isAvailable })}
                    onError={(caught): void =>
                        toast(
                            errorText(t, caught instanceof ApiError ? caught.code : "generic"),
                            "error",
                        )
                    }
                />
            ) : null}
            <BottomSpacer />
        </main>
    )
}

/** A typed name moves the category, like typing it in the field. */
function nameGuess(name: string): Partial<Draft> {
    const guess = guessCategory(name)
    return guess ? { category: guess } : {}
}

function EditorFields({
    draft,
    product,
    gap,
    patch,
    onSearch,
    onSaveNext,
    saving,
}: {
    draft: Draft
    product: ProductDTO | undefined
    gap: ReturnType<typeof missing>
    patch(change: Partial<Draft>): void
    onSearch?: () => void
    onSaveNext?: () => void
    saving: boolean
}): React.JSX.Element {
    const t = useT()
    const prices = new Set(optionsBody(draft.options)?.variants.map((v) => v.price))
    return (
        <>
            <ProductPreview
                product={product}
                name={draft.name}
                price={hasVariants(draft.options) ? priceOf(draft) : draft.price}
                unit={draft.unit}
                category={draft.category}
                priceFrom={prices.size > 1}
                photo={draft.photo}
                onPhoto={(photo): void => patch({ photo })}
            />
            <NameField draft={draft} product={product} error={gap === "name"} patch={patch} />
            <PriceField draft={draft} patch={patch} error={gap === "price"} />
            <KindFields draft={draft} patch={patch} />
            <OptionsEditor
                draft={draft.options}
                addons={!isWeightUnit(draft.unit)}
                suggestions={draft.suggestedAddons}
                onChange={(options): void => patch({ options })}
            />
            <Description
                value={draft.description}
                onChange={(description): void => patch({ description })}
            />
            {onSaveNext ? (
                <Button variant="secondary" loading={saving} onClick={onSaveNext}>
                    {t.owner.product.saveAndNext}
                </Button>
            ) : null}
            {onSearch ? (
                <button
                    type="button"
                    onClick={onSearch}
                    className="tap flex min-h-11 items-center gap-2 self-start rounded-control px-1 font-semibold text-brand"
                >
                    <SearchIcon size={18} />
                    {t.owner.product.searchAgain}
                </button>
            ) : null}
        </>
    )
}

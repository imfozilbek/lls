import { useT, fill } from "../i18n/index.js"
import { haptic } from "../lib/telegram.js"
import { CloseIcon, ListIcon, PlusIcon } from "../ui/icons.js"
import { MoneyInput, TextInput } from "../ui/primitives.js"

import type { ProductOptionsProps } from "@zumda/core"

/** A row being typed: the price may still be empty. */
export interface OptionRow {
    id: string
    name: string
    price: number | null
}

export interface OptionsDraft {
    group: string
    variants: OptionRow[]
    addons: OptionRow[]
}

export const NO_OPTIONS: OptionsDraft = { group: "", variants: [], addons: [] }

/** A short id the server accepts (`[a-z0-9]{1,12}`): new rows get one, kept rows keep theirs. */
function newId(): string {
    return Math.random().toString(36).slice(2, 10) || "o1"
}

export function optionsDraftOf(options: ProductOptionsProps | undefined): OptionsDraft {
    if (!options) {
        return NO_OPTIONS
    }
    return {
        group: options.group ?? "",
        variants: options.variants.map((v) => ({ ...v })),
        addons: options.addons.map((a) => ({ ...a })),
    }
}

/** Rows with a name; an add-on without a price is free. */
function filled(rows: readonly OptionRow[]): OptionRow[] {
    return rows.filter((row) => row.name.trim().length > 0)
}

/** Ready to save: no variants, or two or more, each with a name and a price. */
export function optionsValid(draft: OptionsDraft): boolean {
    const variants = filled(draft.variants)
    return (
        variants.length === 0 || (variants.length >= 2 && variants.every((v) => (v.price ?? 0) > 0))
    )
}

export function hasVariants(draft: OptionsDraft): boolean {
    return filled(draft.variants).length > 0
}

/** What the API takes, or null when nothing is left (drops the old options). */
export function optionsBody(draft: OptionsDraft): ProductOptionsProps | null {
    const variants = filled(draft.variants).map((v) => ({
        id: v.id,
        name: v.name.trim(),
        price: v.price ?? 0,
    }))
    const addons = filled(draft.addons).map((a) => ({
        id: a.id,
        name: a.name.trim(),
        price: a.price ?? 0,
    }))
    if (variants.length === 0 && addons.length === 0) {
        return null
    }
    const group = draft.group.trim()
    return { ...(group && variants.length > 0 ? { group } : {}), variants, addons }
}

/** A closed block: one tap opens it with its first rows. */
function OpenBlock({
    title,
    hint,
    icon,
    onOpen,
}: {
    title: string
    hint: string
    icon: React.ReactNode
    onOpen(): void
}): React.JSX.Element {
    return (
        <button
            type="button"
            onClick={(): void => {
                haptic.tap()
                onOpen()
            }}
            className="tap flex items-center gap-3 rounded-tile border-[1.5px] border-dashed border-tg-separator p-3.5 text-left"
        >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-brand/10 text-brand">
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-tg-hint">{hint}</span>
            </span>
            <PlusIcon size={20} className="shrink-0 text-tg-hint" />
        </button>
    )
}

function Rows({
    rows,
    namePlaceholder,
    nameLabel,
    onChange,
}: {
    rows: OptionRow[]
    namePlaceholder: string
    nameLabel: string
    onChange(rows: OptionRow[]): void
}): React.JSX.Element {
    const t = useT()
    const set = (index: number, change: Partial<OptionRow>): void =>
        onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)))
    return (
        <>
            {rows.map((row, index) => (
                <div key={row.id} className="flex items-center gap-2">
                    <TextInput
                        value={row.name}
                        maxLength={40}
                        placeholder={namePlaceholder}
                        aria-label={nameLabel}
                        className="min-w-0 flex-1 bg-tg-bg"
                        onChange={(e): void => set(index, { name: e.target.value })}
                    />
                    <div className="w-36 shrink-0">
                        <MoneyInput
                            value={row.price}
                            label={fill(t.owner.product.optionPrice, { name: row.name || "…" })}
                            onChange={(price): void => set(index, { price })}
                        />
                    </div>
                    <button
                        type="button"
                        aria-label={fill(t.owner.product.removeOption, { name: row.name || "…" })}
                        onClick={(): void => onChange(rows.filter((_, i) => i !== index))}
                        className="tap grid h-11 w-9 shrink-0 place-items-center rounded-control text-tg-hint"
                    >
                        <CloseIcon size={18} />
                    </button>
                </div>
            ))}
        </>
    )
}

function Group({
    title,
    hint,
    children,
    more,
    onMore,
}: {
    title: string
    hint: string
    children: React.ReactNode
    more: string
    onMore(): void
}): React.JSX.Element {
    return (
        <section className="flex flex-col gap-2 rounded-tile bg-tg-secondary p-3">
            <div className="flex items-baseline justify-between gap-3 px-1">
                <h2 className="font-semibold">{title}</h2>
                <span className="text-right text-sm text-tg-hint">{hint}</span>
            </div>
            {children}
            <button
                type="button"
                onClick={onMore}
                className="tap flex min-h-11 items-center gap-1.5 self-start rounded-control px-1 font-semibold text-brand"
            >
                <PlusIcon size={18} />
                {more}
            </button>
        </section>
    )
}

/**
 * Variants (one is picked, each with its price: «0,3 l», «0,4 l») and add-ons (several, priced on
 * top, 0 is free). Closed until the owner needs them; a weight item takes no add-ons.
 */
export function OptionsEditor({
    draft,
    addons,
    onChange,
}: {
    draft: OptionsDraft
    /** False for weight items: they sell by the gram, add-ons do not fit. */
    addons: boolean
    onChange(draft: OptionsDraft): void
}): React.JSX.Element {
    const t = useT()
    const p = t.owner.product
    const row = (): OptionRow => ({ id: newId(), name: "", price: null })
    return (
        <>
            {draft.variants.length === 0 ? (
                <OpenBlock
                    title={p.variants}
                    hint={p.variantsHint}
                    icon={<ListIcon size={20} />}
                    onOpen={(): void => onChange({ ...draft, variants: [row(), row()] })}
                />
            ) : (
                <Group
                    title={p.variants}
                    hint={p.variantsHint}
                    more={p.addVariant}
                    onMore={(): void =>
                        onChange({ ...draft, variants: [...draft.variants, row()] })
                    }
                >
                    <TextInput
                        value={draft.group}
                        maxLength={30}
                        aria-label={p.variantsWhat}
                        placeholder={`${p.variantsWhat} ${p.variantsWhatPlaceholder}`}
                        className="bg-tg-bg"
                        onChange={(e): void => onChange({ ...draft, group: e.target.value })}
                    />
                    <Rows
                        rows={draft.variants}
                        nameLabel={p.variantName}
                        namePlaceholder={p.variantPlaceholder}
                        onChange={(variants): void => onChange({ ...draft, variants })}
                    />
                </Group>
            )}
            {!addons ? null : draft.addons.length === 0 ? (
                <OpenBlock
                    title={p.addons}
                    hint={p.addonsHint}
                    icon={<PlusIcon size={20} />}
                    onOpen={(): void => onChange({ ...draft, addons: [row()] })}
                />
            ) : (
                <Group
                    title={p.addons}
                    hint={p.addonsHint}
                    more={p.addAddon}
                    onMore={(): void => onChange({ ...draft, addons: [...draft.addons, row()] })}
                >
                    <Rows
                        rows={draft.addons}
                        nameLabel={p.addonName}
                        namePlaceholder={p.addonPlaceholder}
                        onChange={(rows): void => onChange({ ...draft, addons: rows })}
                    />
                </Group>
            )}
        </>
    )
}

import { useEffect, useMemo, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { formatMoney } from "../lib/format.js"
import { useBackButton, useClosingGuard, useMainAction } from "../lib/main-button.js"
import { confirm, haptic } from "../lib/telegram.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { AlertIcon, CategoryIcon } from "../ui/icons.js"
import { TextArea } from "../ui/primitives.js"
import { BottomSpacer } from "../ui/shell.js"

import { parseList, readyRows } from "./bulk.js"
import { byName, loadCatalog } from "./catalog.js"
import { useOwner } from "./store.js"

import type { BulkRow } from "./bulk.js"
import type { Template } from "./catalog.js"

/** The catalog's names, once it has loaded (the list works without it, by the name's words). */
function useFindTemplate(): (name: string) => Template | undefined {
    const none = (): Template | undefined => undefined
    const [find, setFind] = useState<(name: string) => Template | undefined>(() => none)
    useEffect(() => {
        loadCatalog()
            .then((catalog) => setFind(() => byName(catalog)))
            .catch(() => undefined)
    }, [])
    return find
}

function RowView({ row }: { row: BulkRow }): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const p = t.owner.product
    const categories = t.categories as Record<string, string>
    const units = t.units as Record<string, string>
    return (
        <li className="flex items-center gap-3 py-2.5">
            <span
                className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-control",
                    row.error
                        ? "bg-tg-destructive/10 text-tg-destructive"
                        : "bg-brand/10 text-brand",
                )}
            >
                {row.error ? (
                    <AlertIcon size={20} />
                ) : (
                    <CategoryIcon category={row.category} size={20} />
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-medium">{row.name || row.line}</span>
                <span
                    className={cn(
                        "block text-sm",
                        row.error ? "text-tg-destructive" : "text-tg-hint",
                    )}
                >
                    {row.error
                        ? fill(p.bulkErrors[row.error], { name: row.name || row.line.trim() })
                        : `${categories[row.category] ?? row.category} · ${units[row.unit] ?? row.unit}`}
                </span>
            </span>
            {row.error ? null : (
                <span className="shrink-0 font-semibold tabular-nums">
                    {formatMoney(row.price, language)}
                </span>
            )}
        </li>
    )
}

/**
 * «Ro'yxat bilan qo'shish» (goal 17): one product a line, «Nomi narx [birlik]». The catalog gives
 * the category and the unit; a wrong line stays in the box, marked, and the good ones are added.
 */
export function BulkAdd(): React.JSX.Element {
    const t = useT()
    const p = t.owner.product
    const back = useRouter((state) => state.back)
    const type = useSession((state) => state.shop?.type)
    const loadProducts = useOwner((state) => state.loadProducts)
    const find = useFindTemplate()
    const [text, setText] = useState("")
    const [saving, setSaving] = useState(false)
    const rows = useMemo(() => parseList(text, type, find), [text, type, find])
    const ready = readyRows(rows)
    const dirty = text.trim().length > 0
    useClosingGuard(dirty && !saving)
    useBackButton(
        dirty
            ? (): void => {
                  const options = { yes: t.common.leave, no: t.common.stay, destructive: true }
                  void confirm(p.unsavedLeave, options).then((leave) => leave && back())
              }
            : null,
    )

    const add = async (): Promise<void> => {
        if (ready.length === 0) {
            haptic.error()
            toast(p.bulkNothing, "error")
            return
        }
        setSaving(true)
        try {
            const { created, skipped } = await api.owner.createProducts(
                ready.map(({ name, price, unit, step, category }) => ({
                    name,
                    price,
                    unit,
                    category,
                    ...(step > 1 ? { step } : {}),
                })),
            )
            await loadProducts()
            haptic.success()
            const sent = new Set(ready.map((row) => row.line))
            const left = rows.filter((row) => !sent.has(row.line)).map((row) => row.line)
            // One toast at a time: what was added, what was there already, what is left to fix.
            const parts = created.length > 0 ? [fill(p.bulkAdded, { n: created.length })] : []
            if (skipped.length > 0) {
                parts.push(fill(p.bulkSkipped, { n: skipped.length }))
            }
            if (left.length > 0) {
                parts.push(p.bulkLeft)
            }
            toast(parts.join(". "), created.length > 0 ? "success" : "info")
            if (left.length === 0) {
                setText("")
                back()
                return
            }
            setText(left.join("\n"))
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setSaving(false)
        }
    }

    useMainAction({
        text: saving ? t.common.saving : fill(p.bulkAdd, { n: ready.length }),
        onClick: (): void => void add(),
        loading: saving,
    })

    return (
        <main className="flex flex-col gap-4 px-4 pt-4">
            <h1 className="text-2xl font-bold">{p.bulk}</h1>
            <p className="-mt-2 px-1 text-tg-hint">{p.bulkHint}</p>
            <TextArea
                aria-label={p.bulk}
                value={text}
                rows={8}
                placeholder={p.bulkPlaceholder}
                className="leading-relaxed"
                onChange={(e): void => setText(e.target.value)}
            />
            {rows.length > 0 ? (
                <>
                    <p className="px-1 text-sm font-semibold text-tg-hint">
                        {fill(p.bulkReady, { n: ready.length })}
                    </p>
                    <ul className="flex flex-col divide-y divide-tg-separator">
                        {rows.map((row, line) => (
                            <RowView key={line} row={row} />
                        ))}
                    </ul>
                </>
            ) : null}
            <BottomSpacer />
        </main>
    )
}

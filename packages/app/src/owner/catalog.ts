import { CATEGORIES, SHELF_OF, UNITS, categoryGroup, searchText, searchWords } from "@zumda/core"

import type { BusinessType, Category, Unit } from "@zumda/core"

/** A product of the Zumda catalog (goal 17): everything but the price and the photo. */
export interface Template {
    name: string
    category: Category
    unit: Unit
    /** Grams per step for weight units. */
    step?: number
    /** What the variants are («Hajmi», «Porsiya», «Mashina turi»); their prices are the owner's. */
    group?: string
    variants: string[]
    /** Add-ons people usually take with it; suggested, never added by themselves. */
    addons: string[]
}

interface Indexed {
    template: Template
    /** Name words, then alias words, each folded (see `fold`). */
    name: string
    aliases: string
}

type Row = [string, string, string, string, number?, string?, string[]?, string[]?]

const RESULTS = 30
let loading: Promise<Indexed[]> | null = null

/**
 * Like the storefront's search (apostrophes dropped, Cyrillic in Latin), and x/h as one letter:
 * people write «xamir» and «hamir», «choyxona» and «choyhona».
 */
export function fold(text: string): string {
    return ` ${searchText(text).replace(/h/g, "x")}`
}

function toTemplate(row: Row): Template | null {
    const [name, , category, unit, step, group, variants, addons] = row
    if (!CATEGORIES.includes(category as Category) || !UNITS.includes(unit as Unit)) {
        return null
    }
    return {
        name,
        category: category as Category,
        unit: unit as Unit,
        ...(step ? { step } : {}),
        ...(group ? { group } : {}),
        variants: variants ?? [],
        addons: addons ?? [],
    }
}

export function indexCatalog(rows: readonly Row[]): Indexed[] {
    const indexed: Indexed[] = []
    for (const row of rows) {
        const template = toTemplate(row)
        if (template) {
            indexed.push({
                template,
                name: fold(row[0]),
                aliases: fold(row[1].replace(/\|/g, " ")),
            })
        }
    }
    return indexed
}

/** The catalog file, fetched once from the app's own address (no Worker request) and kept. */
export function loadCatalog(): Promise<Indexed[]> {
    loading ??= fetch(`${import.meta.env.BASE_URL}catalog/v1.json`)
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`catalog ${response.status}`)
            }
            const body = (await response.json()) as { items: Row[] }
            return indexCatalog(body.items)
        })
        .catch((error: unknown) => {
            loading = null
            throw error
        })
    return loading
}

/**
 * Templates for a query: every word must start a word of the name or an alias. The name's own
 * start first, then the shelf of the shop's kind, then shorter names.
 */
export function searchCatalog(
    catalog: readonly Indexed[],
    query: string,
    type: BusinessType | undefined,
): Template[] {
    const words = searchWords(query).map((word) => ` ${word.replace(/h/g, "x")}`)
    if (words.length === 0) {
        return []
    }
    const shelf = type ? SHELF_OF[type] : undefined
    const found: { template: Template; rank: number }[] = []
    for (const item of catalog) {
        const inName = words.every((word) => item.name.includes(word))
        if (!inName && !words.every((word) => (item.name + item.aliases).includes(word))) {
            continue
        }
        const start = item.name.startsWith(words[0] ?? "") ? 0 : 1
        const own = shelf && categoryGroup(item.template.category) === shelf ? 0 : 2
        found.push({ template: item.template, rank: (inName ? 0 : 4) + start + own })
    }
    return found
        .sort((a, b) => a.rank - b.rank || a.template.name.length - b.template.name.length)
        .slice(0, RESULTS)
        .map((f) => f.template)
}

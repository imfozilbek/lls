import {
    MAX_PRODUCTS_AT_ONCE,
    SUGGESTED_CATEGORIES,
    SUGGESTED_UNITS,
    Unit,
    defaultStep,
    searchText,
} from "@zumda/core"

import { guessCategory } from "../lib/category-guess.js"

import { fold } from "./catalog.js"

import type { Template } from "./catalog.js"
import type { BusinessType, Category } from "@zumda/core"

/** Unit words an owner may end a line with («Pomidor 12000 kg»), in search spelling. */
const UNIT_WORDS: ReadonlyArray<[string, Unit]> = [
    ["100 g", Unit.G100],
    ["100g", Unit.G100],
    ["19 l", Unit.BOTTLE_19L],
    ["20 l", Unit.BOTTLE_20L],
    ["kg", Unit.KG],
    ["kilo", Unit.KG],
    ["gramm", Unit.GRAM],
    ["g", Unit.GRAM],
    ["litr", Unit.LITER],
    ["l", Unit.LITER],
    ["dona", Unit.PIECE],
    ["ta", Unit.PIECE],
    ["porsiya", Unit.PORTION],
    ["qadoq", Unit.PACK],
    ["pachka", Unit.PACK],
    ["quti", Unit.BOX],
    ["bog", Unit.BUNCH],
    ["toplam", Unit.SET],
    ["juft", Unit.PAIR],
    ["lotok", Unit.TRAY],
    ["qop", Unit.SACK],
    ["rulon", Unit.ROLL],
    ["list", Unit.SHEET],
    ["metr", Unit.METRE],
    ["m2", Unit.SQUARE_METRE],
    ["kv", Unit.SQUARE_METRE],
    ["m3", Unit.CUBIC_METRE],
    ["kub", Unit.CUBIC_METRE],
    ["m", Unit.METRE],
    ["soat", Unit.HOUR],
    ["kun", Unit.DAY],
    ["oy", Unit.MONTH],
    ["seans", Unit.SESSION],
    ["reys", Unit.TRIP],
    ["sotix", Unit.SOTIX],
]

const MAX_NAME = 80
const MAX_PRICE = 100_000_000

export type RowError = "noPrice" | "badPrice" | "twin" | "longName"

export interface BulkRow {
    /** The line as typed, to keep it when it cannot be added yet. */
    line: string
    name: string
    price: number
    unit: Unit
    step: number
    category: Category
    error?: RowError
}

/** «Pomidor 12000 kg» → the words, the price, the unit word (all optional but the words). */
function split(line: string): { name: string; price?: number; unit?: Unit; badPrice: boolean } {
    let rest = ` ${line.trim()} `
    let unit: Unit | undefined
    const text = searchText(line)
    for (const [word, value] of UNIT_WORDS) {
        if (text.endsWith(` ${word}`) || text === word) {
            unit = value
            // Drop the unit word as typed (any case, «m²» too) from the end of the line.
            rest = ` ${line.trim().slice(0, -lastWordLength(line, word)).trim()} `
            break
        }
    }
    // «38000», «38 000», «38.000»: groups of three only, so «Taom 1 1000» costs 1 000.
    const price = /\s(\d{1,3}(?:[\s.,]\d{3})+|\d+)\s*(so'?m|sum)?\s*$/i.exec(rest)
    if (!price?.[1]) {
        return { name: rest.trim(), unit, badPrice: false }
    }
    const digits = price[1].replace(/[\s.,]/g, "")
    const amount = Number(digits)
    return {
        name: rest.slice(0, price.index).trim(),
        price: amount,
        unit,
        badPrice: !Number.isSafeInteger(amount) || amount < 1 || amount > MAX_PRICE,
    }
}

/** How many characters the unit word took at the end of the typed line («m²», «100 g»). */
function lastWordLength(line: string, word: string): number {
    const parts = line.trim().split(/\s+/)
    const words = word.split(" ").length
    return parts.slice(-words).join(" ").length
}

/** What keeps a line out of the request, if anything. */
function rowError(parts: ReturnType<typeof split>, twin: boolean): RowError | undefined {
    if (parts.price === undefined) {
        return "noPrice"
    }
    if (parts.badPrice) {
        return "badPrice"
    }
    if (parts.name.length > MAX_NAME) {
        return "longName"
    }
    return twin ? "twin" : undefined
}

function categoryOf(
    name: string,
    template: Template | undefined,
    type: BusinessType | undefined,
): Category {
    return (
        template?.category ??
        guessCategory(name) ??
        (type ? SUGGESTED_CATEGORIES[type][0] : undefined) ??
        "other"
    )
}

/**
 * Lines of «Nomi narx [birlik]» → products to add. The category and the unit come from the Zumda
 * catalog when the name is there, otherwise from the name's words and the shop's kind.
 */
export function parseList(
    text: string,
    type: BusinessType | undefined,
    findTemplate: (name: string) => Template | undefined,
): BulkRow[] {
    const seen = new Set<string>()
    const rows: BulkRow[] = []
    for (const line of text.split("\n")) {
        if (line.trim().length === 0) {
            continue
        }
        const parts = split(line)
        const template = findTemplate(parts.name)
        const unit =
            parts.unit ?? template?.unit ?? (type && SUGGESTED_UNITS[type][0]) ?? Unit.PIECE
        const key = fold(parts.name)
        const error = rowError(parts, seen.has(key))
        seen.add(key)
        rows.push({
            line,
            name: parts.name,
            price: parts.price ?? 0,
            unit,
            step: template?.unit === unit && template.step ? template.step : defaultStep(unit),
            category: categoryOf(parts.name, template, type),
            ...(error ? { error } : {}),
        })
    }
    return rows
}

/** The rows that go in one request: the good ones, at most 50. */
export function readyRows(rows: readonly BulkRow[]): BulkRow[] {
    return rows.filter((row) => !row.error && row.name.length > 0).slice(0, MAX_PRODUCTS_AT_ONCE)
}

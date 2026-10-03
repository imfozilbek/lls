import { BusinessType, Language } from "@zumda/core"
import { create } from "zustand"

import { useSession } from "../stores/session.js"

import { FOOD_UZ } from "./food.js"
import { SERVICE_UZ } from "./service.js"
import { uz } from "./uz.js"

import type { Dictionary } from "./uz.js"

export type { Dictionary }

/**
 * Uzbek (Latin) only (owner's decision). Another language is one more dictionary with the same
 * keys, added here and to `Language`.
 */
const DICTIONARIES: Record<Language, Dictionary> = { uz }
/** Same keys, food words: "Menyu", "Tayyorlanmoqda", "Yoqimli ishtaha!". */
const FOOD_DICTIONARIES: Record<Language, Dictionary> = {
    uz: { ...uz, ...FOOD_UZ(uz) } as Dictionary,
}
/** Same keys, service words: "Xizmatlar", "Bajarilmoqda", "Bajarildi". */
const SERVICE_DICTIONARIES: Record<Language, Dictionary> = {
    uz: { ...uz, ...SERVICE_UZ(uz) } as Dictionary,
}

/** The words that differ by kind of business; a grocery store uses the base dictionary. */
const OVERLAYS: Partial<Record<BusinessType, Record<Language, Dictionary>>> = {
    [BusinessType.FOOD]: FOOD_DICTIONARIES,
    [BusinessType.SERVICE]: SERVICE_DICTIONARIES,
}

interface LanguageState {
    language: Language
    setLanguage(language: Language): void
}

export const useLanguageStore = create<LanguageState>((set) => ({
    language: Language.UZ,
    setLanguage: (language): void => {
        document.documentElement.lang = language
        set({ language })
    },
}))

/** The dictionary for the current language, worded for the current shop's kind of business. */
export function useT(): Dictionary {
    const language = useLanguageStore((state) => state.language)
    const type = useSession((state) => state.shop?.type)
    return dictionaryFor(language, type)
}

export function useLanguage(): Language {
    return useLanguageStore((state) => state.language)
}

/** "{n}" / "{sum}" placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in values ? String(values[key]) : match,
    )
}

/** Translated message for an API error code, or the generic one. */
export function errorText(t: Dictionary, code: string): string {
    const known = (t.errors as Record<string, string>)[code]
    return known ?? t.errors.generic
}

export function dictionaryFor(language: Language, type?: BusinessType): Dictionary {
    return (type ? OVERLAYS[type]?.[language] : undefined) ?? DICTIONARIES[language]
}

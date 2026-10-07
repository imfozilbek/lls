import { BusinessType, Language } from "@zumda/core"
import { create } from "zustand"

import { useSession } from "../stores/session.js"

import { FOOD_STAFF, FOOD_UZ } from "./food.js"
import { SERVICE_STAFF, SERVICE_UZ } from "./service.js"
import { uz } from "./uz.js"

import type { StaffDictionary } from "./staff.js"
import type { Dictionary } from "./uz.js"

export type { Dictionary }

type Base = typeof uz
type Overlay<D> = (base: D) => Partial<D>

/**
 * Uzbek (Latin) only (owner's decision). Another language is one more dictionary with the same
 * keys, added here and to `Language`.
 */
const BASE: Record<Language, Base> = { uz }

/** The words that differ by kind of business; a grocery store uses the base words. */
const OVERLAYS: Partial<Record<BusinessType, Overlay<Base>>> = {
    [BusinessType.FOOD]: FOOD_UZ as Overlay<Base>,
    [BusinessType.SERVICE]: SERVICE_UZ as Overlay<Base>,
}
const STAFF_OVERLAYS: Partial<Record<BusinessType, Overlay<StaffDictionary>>> = {
    [BusinessType.FOOD]: FOOD_STAFF as Overlay<StaffDictionary>,
    [BusinessType.SERVICE]: SERVICE_STAFF as Overlay<StaffDictionary>,
}

/** The staff's words, once a staff chunk has loaded them (`staff-register.ts`). */
let staffWords: Record<Language, StaffDictionary> | null = null
/** One object per language and kind, so `useT()` stays stable between renders. */
const built = new Map<string, Dictionary>()

/** Called by the owner, courier, application and «Platforma» chunks before they render. */
export function registerStaff(words: Record<Language, StaffDictionary>): void {
    staffWords = words
    built.clear()
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
    const key = `${language}:${type ?? ""}`
    const cached = built.get(key)
    if (cached) {
        return cached
    }
    const base = BASE[language]
    const overlay = type ? OVERLAYS[type] : undefined
    const staff = staffWords?.[language]
    const staffOverlay = type ? STAFF_OVERLAYS[type] : undefined
    // Before a staff chunk loads, only the customer's words exist; staff screens never render then.
    const dictionary = {
        ...base,
        ...overlay?.(base),
        ...(staff ? { ...staff, ...staffOverlay?.(staff) } : {}),
    } as Dictionary
    built.set(key, dictionary)
    return dictionary
}

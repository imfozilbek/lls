import { Language } from "@lls/core"
import { create } from "zustand"

import { ru } from "./ru.js"
import { uz } from "./uz.js"

import type { Dictionary } from "./uz.js"

export type { Dictionary }

const DICTIONARIES: Record<Language, Dictionary> = { uz, ru }

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

export function useT(): Dictionary {
    return DICTIONARIES[useLanguageStore((state) => state.language)]
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

export function dictionaryFor(language: Language): Dictionary {
    return DICTIONARIES[language]
}

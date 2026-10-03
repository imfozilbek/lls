/**
 * Languages of the product. Only Uzbek (Latin) for now (owner's decision): another language is
 * one more value here, one more dictionary in the app and in the bots.
 */
export enum Language {
    UZ = "uz",
}

export const LANGUAGES: readonly Language[] = Object.values(Language)

export const DEFAULT_LANGUAGE = Language.UZ

/** A stored or sent language: an unsupported one (e.g. old "ru" rows) reads as the default. */
export function toLanguage(value: string | undefined | null): Language {
    const code = value?.toLowerCase() ?? ""
    return LANGUAGES.find((language) => code.startsWith(language)) ?? DEFAULT_LANGUAGE
}

/** Telegram `language_code` → the product language. */
export function languageFromTelegram(code: string | undefined): Language {
    return toLanguage(code)
}

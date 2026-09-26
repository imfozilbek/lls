export enum Language {
    UZ = "uz",
    RU = "ru",
}

export const LANGUAGES: readonly Language[] = Object.values(Language)

/** Telegram `language_code` → app language. Russian stays Russian, everything else is Uzbek. */
export function languageFromTelegram(code: string | undefined): Language {
    return code?.toLowerCase().startsWith("ru") ? Language.RU : Language.UZ
}

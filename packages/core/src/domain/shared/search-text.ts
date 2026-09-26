/**
 * One spelling for search: people in the regions type Uzbek in Latin or Cyrillic, with any kind
 * of apostrophe, and Russian in Cyrillic. Both the stored product text and the query go through
 * the same function, so «ош», «Osh» and «OSH» meet, and «лагмон» finds «Lag'mon».
 */
const CYRILLIC_TO_LATIN: Readonly<Record<string, string>> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    ғ: "g",
    д: "d",
    е: "e",
    ё: "yo",
    ж: "j",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    қ: "q",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ў: "o",
    ф: "f",
    х: "x",
    ҳ: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sh",
    ъ: "",
    ы: "i",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
}

/** Apostrophes of o', g' and the Cyrillic hard sign: dropped, so "o'" and "o" match. */
const APOSTROPHES = /['ʻʼ‘’`´]/g
const NOT_WORD = /[^a-z0-9]+/g

export function searchText(...parts: readonly (string | undefined)[]): string {
    const lower = parts
        .filter((part): part is string => part !== undefined)
        .join(" ")
        .toLowerCase()
        .replace(APOSTROPHES, "")
    let latin = ""
    for (const char of lower) {
        latin += CYRILLIC_TO_LATIN[char] ?? char
    }
    return latin.replace(NOT_WORD, " ").trim()
}

/** The words of a query; each must appear in the product text. */
export function searchWords(query: string): string[] {
    return searchText(query)
        .split(" ")
        .filter((word) => word.length > 0)
}

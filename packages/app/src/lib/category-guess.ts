import type { Category } from "@zumda/core"

/**
 * Word stems an owner types in a product name (Uzbek Latin and Cyrillic, Russian), and the
 * category they point to. The first match wins, so narrower words come before wider ones.
 */
const STEMS: readonly [Category, readonly string[]][] = [
    ["water", ["suv", "вода", "сув", "19 l", "19л"]],
    ["soups", ["sho'rva", "shorva", "mastava", "chuchvara", "шурпа", "суп", "мастава", "шўрва"]],
    ["salads", ["salat", "салат", "achchiq-chuchuk", "ачичук"]],
    ["grill", ["kabob", "shashlik", "jiz", "grill", "кабоб", "шашлык", "гриль"]],
    ["pizza", ["pitsa", "pizza", "пицца", "пица"]],
    ["burgers", ["burger", "lavash", "shaurma", "hot-dog", "hotdog", "бургер", "лаваш", "шаурма"]],
    ["desserts", ["tort", "shirinlik", "muzqaymoq", "pirojn", "торт", "десерт", "мороже"]],
    ["bakery", ["non", "somsa", "patir", "pishiriq", "нон", "хлеб", "самса", "сомса", "лепёш"]],
    [
        "drinks",
        [
            "choy",
            "kofe",
            "coffee",
            "latte",
            "sharbat",
            "kola",
            "cola",
            "ichimlik",
            "чай",
            "кофе",
            "сок",
            "напит",
            "лимонад",
        ],
    ],
    [
        "dairy",
        [
            "sut",
            "qatiq",
            "pishloq",
            "smetana",
            "kefir",
            "tvorog",
            "сут",
            "молок",
            "сыр",
            "кефир",
            "творог",
            "сметан",
        ],
    ],
    ["meat", ["go'sht", "gosht", "tovuq", "qiyma", "мясо", "гўшт", "курица", "фарш"]],
    [
        "produce",
        [
            "olma",
            "pomidor",
            "bodring",
            "kartoshka",
            "piyoz",
            "sabzi",
            "meva",
            "sabzavot",
            "яблок",
            "помидор",
            "картош",
            "лук",
            "фрукт",
            "овощ",
        ],
    ],
    [
        "groceries",
        ["un ", "guruch", "yog'", "shakar", "makaron", "мука", "рис", "масло", "сахар", "макарон"],
    ],
    ["household", ["sovun", "poroshok", "shampun", "мыло", "порошок", "шампун"]],
    [
        "meals",
        [
            "osh",
            "palov",
            "manti",
            "lag'mon",
            "lagmon",
            "norin",
            "dimlama",
            "qozon",
            "плов",
            "манты",
            "лагман",
            "ош",
        ],
    ],
]

/** The category a product name most likely belongs to, or null when no word is known. */
export function guessCategory(name: string): Category | null {
    const text = ` ${name.toLowerCase().replace(/[ʻʼ`‘’]/g, "'")} `
    for (const [category, stems] of STEMS) {
        if (stems.some((stem) => text.includes(stem))) {
            return category
        }
    }
    return null
}

import type { Category } from "@zumda/core"

/**
 * Word stems an owner types in a product name (Uzbek Latin and Cyrillic, Russian), and the
 * category they point to. The first match wins, so narrower words come before wider ones.
 */
const STEMS: readonly [Category, readonly string[]][] = [
    ["water", ["suv", "вода", "сув", "19 l", "19л", "20 l", "20л"]],
    ["carpet", ["gilam", "kovyor", "ковёр", "ковер", "гилам"]],
    ["car_wash", ["moyka", "мойка"]],
    ["tyres", ["shina", "vulkan", "шина", "шиномон"]],
    ["barber", ["sartarosh", "soch olish", "стрижк", "барбер"]],
    ["lessons", ["dars", "kurs", "repetitor", "урок", "курс"]],
    ["moving", ["yuk tashish", "gruzchik", "грузчик", "перевоз"]],
    ["electrician", ["elektrik", "электрик"]],
    ["plumber", ["santexnik", "сантехник"]],
    ["dough", ["manti", "lag'mon", "lagmon", "chuchvara", "чучвара", "манты", "лагман", "пельмен"]],
    ["osh", [" osh", "palov", "плов", " ош"]],
    ["soups", ["sho'rva", "shorva", "mastava", "шурпа", "суп", "мастава", "шўрва"]],
    ["salads", ["salat", "салат", "achchiq-chuchuk", "ачичук"]],
    ["grill", ["kabob", "shashlik", "jiz", "grill", "кабоб", "шашлык", "гриль"]],
    ["pizza", ["pitsa", "pizza", "пицца", "пица"]],
    ["lavash", ["lavash", "shaurma", "donar", "лаваш", "шаурма", "донар"]],
    ["burgers", ["burger", "hot-dog", "hotdog", "бургер", "хот-дог"]],
    ["cakes", ["tort", "торт"]],
    ["ice_cream", ["muzqaymoq", "морожен"]],
    ["desserts", ["shirinlik", "pirojn", "десерт", "пирожн"]],
    ["bakery", ["non", "somsa", "patir", "pishiriq", "нон", "хлеб", "самса", "сомса", "лепёш"]],
    [
        "coffee",
        ["kofe", "qahva", "coffee", "latte", "kapuchino", "amerikano", "кофе", "латте", "капучино"],
    ],
    ["tea", ["choy", "чай"]],
    ["juices", ["sharbat", "kompot", "сок", "компот"]],
    ["drinks", ["kola", "cola", "ichimlik", "напит", "лимонад"]],
    ["cheese", ["pishloq", "сыр"]],
    ["eggs", ["tuxum", "яйц"]],
    [
        "dairy",
        ["sut", "qatiq", "smetana", "kefir", "tvorog", "сут", "молок", "кефир", "творог", "сметан"],
    ],
    ["poultry", ["tovuq", "курица", "куриц"]],
    ["deli", ["kolbasa", "sosiska", "колбас", "сосиск"]],
    ["fish", ["baliq", "рыба"]],
    ["meat", ["go'sht", "gosht", "qiyma", "мясо", "гўшт", "фарш"]],
    ["spices", ["murch", "zira", "ziravor", "zafaron", "перец", "специ"]],
    ["nuts", ["yong'oq", "yongoq", "pista", "bodom", "орех", "миндал"]],
    ["dried_fruits", ["mayiz", "turshak", "o'rik qoqi", "изюм", "курага"]],
    ["greens", ["ko'kat", "ukrop", "kashnich", "rayhon", "зелен", "укроп"]],
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
    ["rice", ["guruch", "devzira", "рис"]],
    ["flour", ["un ", "мука"]],
    ["oils", ["yog'", "масло"]],
    ["sugar_salt", ["shakar", "tuz ", "сахар", "соль"]],
    ["pasta", ["makaron", "ugra", "макарон"]],
    ["sweets", ["konfet", "shokolad", "конфет", "шоколад"]],
    ["chemicals", ["poroshok", "oqartir", "порошок", "отбелив"]],
    ["hygiene", ["sovun", "shampun", "tish pasta", "мыло", "шампун"]],
    ["building", ["sement", "gips", "g'isht", "цемент", "кирпич"]],
    ["fasteners", ["mix", "shurup", "гвозд", "шуруп"]],
    ["electrical", ["rozetka", "kabel", "lampa", "розетк", "кабель", "лампа"]],
    ["flowers", ["gul", "guldasta", "цвет", "букет"]],
    ["gas", ["gaz ballon", "propan", "газ"]],
    ["meals", ["norin", "dimlama", "qozon", "taom"]],
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

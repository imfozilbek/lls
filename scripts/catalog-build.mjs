#!/usr/bin/env node
/**
 * Builds the Zumda catalog (goal 17) from the research in docs/catalog-research/ into
 * packages/app/public/catalog/v1.json: the templates an owner searches in the product form.
 * No prices and no photos: the owner writes the price and takes the picture.
 *
 *   node scripts/catalog-build.mjs          # build (core must be built: bun run --filter @zumda/core build)
 *   node scripts/catalog-build.mjs --check  # build in memory and fail if the file differs
 *
 * Rules (owner's decisions, October 2026):
 * - services that need a licence (medicine, vets, gas, disinfection, notaries...) are left out;
 * - words nobody confirmed are removed, never guessed (verify.json: the second pass of research);
 * - every category and unit must be one of @zumda/core's, or the build fails.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const RESEARCH = join(ROOT, "docs/catalog-research")
const OUT = join(ROOT, "packages/app/public/catalog/v1.json")
const core = await import(join(ROOT, "packages/core/dist/index.js"))

const read = (name) => JSON.parse(readFileSync(join(RESEARCH, name), "utf8"))

/** The research's sections → the shared categories of @zumda/core. */
const CATEGORY_OF = {
    // grocery.json
    mevalar: "produce",
    sabzavotlar: "produce",
    kokatlar: "greens",
    quruq_mevalar: "dried_fruits",
    yongoqlar: "nuts",
    gosht: "meat",
    parranda: "poultry",
    baliq: "fish",
    kolbasa: "deli",
    sut: "dairy",
    pishloq: "cheese",
    tuxum: "eggs",
    pishiriqlar: "bakery",
    un: "flour",
    guruch: "rice",
    yormalar: "grains",
    dukkaklilar: "grains",
    makaron: "pasta",
    yoglar: "oils",
    shakar_tuz: "sugar_salt",
    ziravorlar: "spices",
    konservalar: "canned",
    tuzlamalar: "pickles",
    souslar: "sauces",
    qahva: "coffee",
    shirinliklar: "sweets",
    shokolad: "sweets",
    pechenye: "cookies",
    murabbo_asal: "honey",
    sneklar: "snacks",
    sharbatlar: "juices",
    ichimliklar: "drinks",
    bolalar_ovqati: "baby_food",
    muzlatilgan: "frozen",
    muzqaymoq: "ice_cream",
    tayyor_ovqat: "ready_food",
    tez_tayyor: "ready_food",
    // food.json (non, nonushta, choy are shared names: see SAME_NAME below)
    osh: "osh",
    shorva: "soups",
    xamir_taomlar: "dough",
    quyuq_taomlar: "meals",
    kabob: "grill",
    somsa: "bakery",
    salat: "salads",
    lavash_shaurma: "lavash",
    burger_hotdog: "burgers",
    tovuq_snek: "chicken",
    pitsa: "pizza",
    sushi: "sushi",
    osiyo: "asian",
    yevropa: "european",
    garnir: "sides",
    sous: "sauces",
    qoshimcha: "other",
    pishiriq: "bakery",
    tort: "cakes",
    desert: "desserts",
    milliy_shirinlik: "national_sweets",
    qahva_food: "coffee",
    sovuq_ichimlik: "drinks",
    fresh: "fresh",
    sut_ichimlik: "milk_drinks",
    kombo: "combo",
    // services.json
    gilam_yumshoq_mebel: "carpet",
    avtomoyka: "car_wash",
    avtoservis: "car_care",
    shinomontaj: "tyres",
    avto_qoshimcha: "car_care",
    elektrik: "electrician",
    santexnik: "plumber",
    payvandlash: "welding",
    qurilish_tamir: "construction",
    konditsioner_isitish: "climate",
    eshik_deraza: "windows",
    mebel: "furniture",
    telefon_kompyuter: "gadgets",
    tozalash: "cleaning",
    kimyoviy_tozalash_kir: "laundry",
    tikuvchilik: "tailoring",
    maishiy_mayda: "workshop",
    sartarosh_erkak: "barber",
    gozallik: "beauty",
    massaj_spa: "massage",
    toy_tadbir: "events",
    oshpaz_keytering: "catering",
    yuk_tashish: "moving",
    taksi_yetkazish: "transport",
    talim: "lessons",
    hayvonlar: "other",
    qishloq_xojaligi: "farming",
    quduq_suv_gaz: "wells",
    bog_hovli: "yard",
    pechat_dizayn: "printing",
    ijara: "rental",
    hujjat_tarjima: "documents",
    enaga_qarovchi: "nanny",
    // nonfood-units.json
    maishiy_kimyo: "chemicals",
    shaxsiy_gigiyena: "hygiene",
    kosmetika: "cosmetics",
    bolalar_tovarlari: "baby_goods",
    qogoz_mahsulotlari: "paper",
    oshxona_idishlari: "kitchenware",
    uy_rozgor: "household",
    uy_tekstili: "textile",
    kiyim_poyabzal: "clothes",
    kanselyariya: "stationery",
    uy_hayvonlari_chorva: "pets",
    gullar_sovgalar: "flowers",
    qurilish_materiallari: "building",
    boyoq_lak: "paint",
    mahkamlagichlar: "fasteners",
    elektr_mollari: "electrical",
    santexnika: "plumbing",
    asbob_uskunalar: "tools",
    bog_dala: "garden",
    avto_mollari: "auto_goods",
    telefon_aksessuarlari: "phone_goods",
    gaz_yoqilgi: "gas",
}
/** Section names used by more than one file, told apart by the file. */
const SAME_NAME = {
    "grocery.json": {
        non: "bakery",
        nonushta: "breakfast",
        choy: "tea",
        suv: "water",
        muzqaymoq: "ice_cream",
    },
    "food.json": {
        non: "bakery",
        nonushta: "breakfast",
        choy: "hot_drinks",
        qahva: "coffee",
        muzqaymoq: "ice_cream",
    },
    "services.json": { maishiy_texnika: "repair" },
    "nonfood-units.json": { maishiy_texnika: "appliances", suv: "water" },
}
/** Whole sections left out: they need a licence (owner's decision 4). */
const LICENSED_SECTIONS = new Set(["tibbiy_uyda", "dezinfeksiya"])
const LICENCE_WORDS = /litsenz|licen|regulated|ruxsat|permit/i

/** The research's units → @zumda/core's; a unit with no counterpart becomes pieces. */
const UNIT_OF = {
    pcs: "pcs",
    dona: "pcs",
    portion: "portion",
    kg: "kg",
    g100: "g100",
    gramm: "g",
    l: "l",
    litr: "l",
    bottle_19l: "bottle_19l",
    bottle_20l: "bottle_20l",
    bunch: "bunch",
    bog: "bunch",
    set: "set",
    toplam: "set",
    qadoq: "pack",
    pachka: "pack",
    blok: "pack",
    quti: "box",
    juft: "pair",
    lotok: "tray",
    qop: "sack",
    rulon: "roll",
    list: "sheet",
    metr: "m",
    m: "m",
    m2: "m2",
    m3: "m3",
    hour: "hour",
    day: "day",
    month: "month",
    session: "session",
    lesson: "session",
    trip: "trip",
    sotix: "sotix",
}
/** Priced per 100 g in the shops (the research's findings): spices, nuts, dried fruit, sweets. */
const BY_100G = new Set(["spices", "nuts", "dried_fruits", "sweets"])

function sizeGroup(sizes) {
    if (sizes.every((s) => /\b(m?l)$/.test(s))) {
        return "Hajmi"
    }
    if (sizes.every((s) => /\b(k?g)$/.test(s))) {
        return "Og'irligi"
    }
    return "O'lchami"
}

/** Cyrillic letters and the em dash, written by their codes so no tool can turn them into text. */
const FORBIDDEN = new RegExp(
    `[${String.fromCharCode(0x400)}-${String.fromCharCode(0x4ff)}${String.fromCharCode(0x2014)}]`,
)

const fold = (text) =>
    text
        .toLowerCase()
        .replace(/[ʻʼ‘’`']/g, "")
        .replace(/\s+/g, " ")
        .trim()

function verified() {
    const file = join(RESEARCH, "verify.json")
    if (!existsSync(file)) {
        return { removed: new Set(), removedIn: new Map(), renamed: new Map() }
    }
    const verify = JSON.parse(readFileSync(file, "utf8"))
    const removed = new Set()
    // A word right in one file and wrong in another (lochira: a bread, not a sweet by the kilo).
    const removedIn = new Map()
    const renamed = new Map()
    for (const entry of [...(verify.nonfood ?? []), ...(verify.doubtful ?? [])]) {
        const key = fold(entry.name ?? entry.word ?? "")
        if (entry.remove_in) {
            removedIn.set(`${entry.remove_in}:${key}`, true)
        }
        if (entry.decision === "remove") {
            removed.add(key)
        } else if (entry.decision === "rename" && entry.new_name) {
            renamed.set(key, entry.new_name)
        }
    }
    return { removed, removedIn, renamed }
}

function categoryOf(file, section) {
    const category = SAME_NAME[file]?.[section] ?? CATEGORY_OF[section]
    if (!category || !core.CATEGORIES.includes(category)) {
        throw new Error(`${file}: section "${section}" has no core category`)
    }
    return category
}

/** One template: [name, aliases, category, unit, step, group, variants, addons], trailing empties cut. */
function template(file, item, check) {
    const category = categoryOf(file, item.category)
    let unit = UNIT_OF[item.unit] ?? "pcs"
    let step = 0
    if (unit === "kg") {
        step = item.step_g ?? 500
        if (step <= 100 && BY_100G.has(category)) {
            unit = "g100"
            step = 100
        }
    }
    if (unit === "g100") {
        step = step || 100
    }
    if (!core.UNITS.includes(unit)) {
        throw new Error(`${item.name}: unit ${unit} is not in core`)
    }
    const name = check.renamed.get(fold(item.name)) ?? item.name
    // A renamed word was wrong: its old spellings go too («Qo'y jaz» → «Jiz», no «jaz»).
    const old = name === item.name ? null : fold(item.name).split(" ").at(-1)
    const aliases = (item.aliases ?? []).filter((alias) => !old || !fold(alias).includes(old))
    let group = ""
    let variants = []
    const research = item.variants?.find((v) => v.options?.length >= 2)
    if (research) {
        group = research.group
        variants = research.options
    } else if ((item.sizes?.length ?? 0) >= 2 && unit !== "kg") {
        group = sizeGroup(item.sizes)
        variants = item.sizes
    }
    const addons = unit === "kg" || unit === "g100" ? [] : (item.addons ?? [])
    const row = [
        name.charAt(0).toUpperCase() + name.slice(1),
        aliases.join("|"),
        category,
        unit,
        step,
        group,
        variants.slice(0, 10).map((v) => String(v).slice(0, 40)),
        addons.slice(0, 15).map((a) => String(a).slice(0, 40)),
    ]
    while (row.length > 4 && (row.at(-1) === 0 || row.at(-1) === "" || row.at(-1)?.length === 0)) {
        row.pop()
    }
    return row
}

function excluded(file, item, check) {
    return (
        check.removedIn.has(`${file}:${fold(item.name)}`) ||
        LICENSED_SECTIONS.has(item.category) ||
        LICENCE_WORDS.test(item.note ?? "") ||
        check.removed.has(fold(item.name))
    )
}

function build() {
    const check = verified()
    const seen = new Set()
    const items = []
    for (const file of ["food.json", "grocery.json", "services.json", "nonfood-units.json"]) {
        for (const item of read(file).items) {
            // Twins are told by the final name: a renamed word may meet one already there.
            const key = fold(check.renamed.get(fold(item.name)) ?? item.name)
            if (seen.has(key) || excluded(file, item, check)) {
                continue
            }
            seen.add(key)
            items.push(template(file, item, check))
        }
    }
    const text = JSON.stringify(items)
    if (FORBIDDEN.test(text)) {
        throw new Error("Cyrillic or an em dash in the catalog")
    }
    return `{"v":1,"items":[\n${items.map((row) => JSON.stringify(row)).join(",\n")}\n]}\n`
}

const out = build()
if (process.argv.includes("--check")) {
    const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : ""
    if (current !== out) {
        console.error(
            "✗ packages/app/public/catalog/v1.json is stale: run node scripts/catalog-build.mjs",
        )
        process.exit(1)
    }
    console.warn("✓ catalog is up to date")
} else {
    mkdirSync(dirname(OUT), { recursive: true })
    writeFileSync(OUT, out)
    console.warn(`✓ ${out.split("\n").length - 3} templates → packages/app/public/catalog/v1.json`)
}

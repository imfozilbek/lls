import { OPTION_LIMITS, foldForGuess } from "@zumda/core"

/** What the variants are told apart by; the form fills «Nima tanlanadi?» with its word. */
export type KindsGroup = "kind" | "colour" | "size"

export interface KindsHint {
    group: KindsGroup
    /** «6 xil»: how many rows to open; none when the name gives no number. */
    count?: number
}

const NOT_LETTER = "(?:^|[^\\p{L}'])"
const END = "(?=$|[^\\p{L}'])"
/** «6 xil», «4xil», «2xili», «6 turi», «3 xildan». */
const COUNTED = /(\d{1,2})\s*-?\s*(?:xil|tur)/u
/** «har xil», «har xilidan», «turli», «bir necha xil». */
const KINDS = new RegExp(`${NOT_LETTER}(?:har xil|turli|bir necha xil)`, "u")
/** «ranglarda», «rangda», «ranglari»: a colour to pick; never «rangli» or «rang-barang». */
const COLOURS = new RegExp(`${NOT_LETTER}rang(?:lar|larda|da|lari|i)?${END}`, "u")
const MANY_COLOURS = /rang-barang/gu
/** A size as the name's last word: «Lavash kichkina», «Pizza Qazi ( katta )». */
const SIZE_LAST = /(?:^|[^\p{L}'])(?:katta|kichik|kichkina|o'rta)[^\p{L}\p{N}']*$/u

/**
 * Does the name say the product comes in kinds the customer cannot pick («6 xil», «Yashil va
 * xaki ranglarda», «Pizza ( katta )»)? Then the form suggests variants. Shops write them in the
 * name because they do not know variants exist (November 2026: no shop had any).
 */
export function kindsHint(name: string): KindsHint | null {
    const text = foldForGuess(name)
    const counted = COUNTED.exec(text)
    if (counted || KINDS.test(text)) {
        const n = Number(counted?.[1] ?? 0)
        return n >= 2 && n <= OPTION_LIMITS.variants
            ? { group: "kind", count: n }
            : { group: "kind" }
    }
    if (COLOURS.test(text.replace(MANY_COLOURS, ""))) {
        return { group: "colour" }
    }
    return SIZE_LAST.test(text) ? { group: "size" } : null
}

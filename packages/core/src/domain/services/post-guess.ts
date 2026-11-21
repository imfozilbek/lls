/** A product's name as the guess sees it. */
export interface NamedProduct {
    id: string
    name: string
}

/** Names this short («Osh», «Tort») would be found inside too many other words. */
const MIN_NAME = 4
/** Every way Uzbek Latin writes the apostrophe of oʻ and gʻ, and of a soft sign. */
const APOSTROPHES = /[ʻʼ'`’‘]/g
const LETTER = /[\p{L}\p{N}']/u

/** Lower case, one apostrophe, one space: «Oʻyinchoq  TO'PLAMI» and «o'yinchoq to'plami» meet. */
export function foldForGuess(text: string): string {
    return text.toLowerCase().replace(APOSTROPHES, "'").replace(/\s+/g, " ").trim()
}

/** `name` stands in `text` as whole words, not inside a longer word. */
function containsWords(text: string, name: string): boolean {
    let from = text.indexOf(name)
    while (from !== -1) {
        const before = text.charAt(from - 1)
        const after = text.charAt(from + name.length)
        if (!LETTER.test(before) && !LETTER.test(after)) {
            return true
        }
        from = text.indexOf(name, from + 1)
    }
    return false
}

/**
 * The product a post made in Telegram is about (owner's decision, November 2026): its text names
 * exactly one product of the shop. A name found inside a longer found name counts as that one
 * («Konstruktor» inside «Magnit konstruktor»); two products, or two with one name, mean the
 * whole shop (`undefined`).
 */
export function guessPostProduct(
    text: string | undefined,
    products: readonly NamedProduct[],
): string | undefined {
    const folded = foldForGuess(text ?? "")
    if (!folded) {
        return undefined
    }
    const found = products
        .map((product) => ({ id: product.id, name: foldForGuess(product.name) }))
        .filter((product) => product.name.length >= MIN_NAME && containsWords(folded, product.name))
    const longest = found.filter(
        (product) =>
            !found.some(
                (other) =>
                    other.name.length > product.name.length && other.name.includes(product.name),
            ),
    )
    const ids = new Set(longest.map((product) => product.id))
    return ids.size === 1 ? longest[0]?.id : undefined
}

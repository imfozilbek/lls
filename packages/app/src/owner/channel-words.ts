import { Unit } from "@zumda/core"

import { fill } from "../i18n/index.js"
import { formatMoney } from "../lib/format.js"

import type { Dictionary } from "../i18n/index.js"
import type { Language, ProductDTO, SourceLinkDTO } from "@zumda/core"

type ChannelWords = Dictionary["owner"]["channel"]

/** «12 kishi kirdi · 2 ta buyurtma · 1 ta yetkazildi: 110 000 so'm»; nobody yet says so. */
export function linkCountsText(c: ChannelWords, link: SourceLinkDTO, language: Language): string {
    if (link.opens === 0 && link.orders === 0) {
        return c.noOpens
    }
    const parts = [
        fill(c.opens, { n: String(link.opens) }),
        fill(c.orders, { n: String(link.orders) }),
    ]
    if (link.sales > 0) {
        const sales = fill(c.sales, { n: String(link.sales) })
        parts.push(`${sales}: ${formatMoney(link.revenue, language)}`)
    }
    return parts.join(" · ")
}

/** What the post says under the owner's words, as the shop's bot writes it. */
export interface PostPreview {
    name: string
    /** «💰 110 000 so'm / kg», «💰 18 000 so'm dan». */
    price: string
    age?: string
}

export function postPreview(
    product: ProductDTO,
    words: Pick<Dictionary, "owner" | "units">,
    language: Language,
): PostPreview {
    const post = words.owner.channel.post
    const money = formatMoney(product.price, language)
    const unit = words.units[product.unit]
    const perUnit = unit && product.unit !== Unit.PORTION ? ` / ${unit}` : ""
    const from = (product.options?.variants.length ?? 0) > 0
    return {
        name: product.name,
        price: `💰 ${from ? fill(post.priceFrom, { price: money }) : `${money}${perUnit}`}`,
        ...(product.ageFrom === undefined
            ? {}
            : { age: fill(post.ageLine, { age: String(product.ageFrom) }) }),
    }
}

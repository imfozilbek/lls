import { useEffect, useState } from "react"

import { useT } from "../i18n/index.js"
import { haptic } from "../lib/telegram.js"
import { CheckIcon } from "../ui/icons.js"
import { Field, TextInput } from "../ui/primitives.js"
import { ProductImage } from "../ui/product-image.js"

import { useOwner } from "./store.js"

import type { ProductDTO } from "@zumda/core"

/** Past this many products the picker gets a search field. */
const SEARCH_FROM = 8

/** The owner's products, loaded once: a post and a link show the product they lead to. */
export function useOwnerProducts(): readonly ProductDTO[] | null {
    const products = useOwner((state) => state.products)
    const loadProducts = useOwner((state) => state.loadProducts)
    useEffect(() => {
        if (products === null) {
            loadProducts().catch(() => undefined)
        }
    }, [products, loadProducts])
    return products
}

/** One product of the shop, picked from its list (an ad link, the owner's own channel post). */
export function ProductPick({
    products,
    picked,
    onPick,
}: {
    products: readonly ProductDTO[]
    picked: string | null
    onPick(id: string): void
}): React.JSX.Element {
    const t = useT()
    const [query, setQuery] = useState("")
    const words = query.trim().toLowerCase()
    const shown = words
        ? products.filter((product) => product.name.toLowerCase().includes(words))
        : products
    return (
        <Field label={t.owner.channel.ads.pickProduct}>
            {products.length > SEARCH_FROM ? (
                <TextInput
                    type="search"
                    value={query}
                    placeholder={t.showcase.search}
                    aria-label={t.showcase.search}
                    onChange={(event): void => setQuery(event.target.value)}
                />
            ) : null}
            <ul className="flex flex-col gap-1.5" role="listbox">
                {shown.map((product) => (
                    <li key={product.id}>
                        <button
                            type="button"
                            role="option"
                            aria-selected={product.id === picked}
                            onClick={(): void => {
                                haptic.select()
                                onPick(product.id)
                            }}
                            className={
                                product.id === picked
                                    ? "tap flex w-full items-center gap-3 rounded-control bg-brand/10 p-2 text-left ring-2 ring-brand"
                                    : "tap flex w-full items-center gap-3 rounded-control bg-tg-secondary p-2 text-left"
                            }
                        >
                            <ProductImage
                                imageKey={product.imageKey}
                                category={product.category}
                                alt={product.name}
                                name={product.name}
                                iconSize={16}
                                className="h-10 w-10 shrink-0 rounded-[0.625rem]"
                            />
                            <span className="min-w-0 flex-1 truncate font-medium">
                                {product.name}
                            </span>
                            {product.id === picked ? (
                                <CheckIcon size={18} className="shrink-0 text-brand" />
                            ) : null}
                        </button>
                    </li>
                ))}
            </ul>
        </Field>
    )
}

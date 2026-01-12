import { type ReactNode } from "react"

import { Skeleton } from "../ui/Loading.js"

import { ProductCard } from "./ProductCard.js"

import type { ProductDTO } from "@lls/core"

interface ProductListProps {
    products: ProductDTO[] | null
    isLoading?: boolean
}

export function ProductList({ products, isLoading }: ProductListProps): ReactNode {
    if (isLoading) {
        return (
            <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-xl bg-telegram-secondary">
                        <Skeleton className="aspect-square rounded-lg mb-3" />
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/2 mb-3" />
                        <Skeleton className="h-8 w-full rounded-lg" />
                    </div>
                ))}
            </div>
        )
    }

    if (!products || products.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-telegram-hint">Нет доступных товаров</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 gap-3">
            {products.map((product) => (
                <ProductCard key={product.id} product={product} />
            ))}
        </div>
    )
}

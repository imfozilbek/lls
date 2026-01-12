import { BusinessType } from "@lls/core"
import { type ReactNode } from "react"
import { useParams } from "react-router-dom"

import { CartButton } from "../../components/cart/CartButton.js"
import { Layout } from "../../components/layout/Layout.js"
import { ProductList } from "../../components/product/ProductList.js"
import { Badge } from "../../components/ui/Badge.js"
import { Skeleton } from "../../components/ui/Loading.js"
import { useBusiness, useProducts } from "../../hooks/useApi.js"
import { getBusinessTypeLabel } from "../../lib/utils.js"

export function Business(): ReactNode {
    const { id } = useParams<{ id: string }>()
    const { data: business, isLoading: businessLoading } = useBusiness(id)
    const { data: products, isLoading: productsLoading, error } = useProducts(id)

    if (businessLoading) {
        return (
            <Layout showBack showNav={false}>
                <div className="p-4">
                    <Skeleton className="h-8 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-4" />
                    <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
                        ))}
                    </div>
                </div>
            </Layout>
        )
    }

    if (!business) {
        return (
            <Layout title="Магазин" showBack showNav={false}>
                <div className="flex flex-col items-center justify-center h-64">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-telegram-hint">Магазин не найден</p>
                </div>
            </Layout>
        )
    }

    return (
        <Layout showBack showNav={false}>
            {/* Header Info */}
            <div className="p-4 border-b border-telegram-secondary">
                <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-xl bg-telegram-button/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-3xl">
                            {business.type === BusinessType.FOOD && "🍔"}
                            {business.type === BusinessType.CONSTRUCTION && "🏗️"}
                            {business.type === BusinessType.WATER && "💧"}
                        </span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-telegram-text">
                            {business.name}
                        </h1>
                        <p className="text-sm text-telegram-hint mt-0.5">
                            {business.address.street}, {business.address.city}
                        </p>
                        <Badge variant="primary" className="mt-2">
                            {getBusinessTypeLabel(business.type)}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Products */}
            <div className="p-4 pb-24">
                {error && (
                    <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm mb-4">
                        {error}
                    </div>
                )}
                <ProductList products={products} isLoading={productsLoading} />
            </div>

            <CartButton />
        </Layout>
    )
}

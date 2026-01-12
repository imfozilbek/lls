import { formatMoney } from "../../lib/utils.js"

import type { TopProductDTO } from "@lls/core"
import type { ReactNode } from "react"

interface TopProductsListProps {
    products: TopProductDTO[]
    className?: string
}

export function TopProductsList({ products, className = "" }: TopProductsListProps): ReactNode {
    if (products.length === 0) {
        return (
            <div className={`flex items-center justify-center py-8 ${className}`}>
                <p className="text-gray-500">Нет данных о продажах</p>
            </div>
        )
    }

    const maxRevenue = Math.max(...products.map((p) => p.revenue.amount), 1)

    return (
        <div className={`space-y-3 ${className}`}>
            {products.map((product, index) => {
                const percentage = (product.revenue.amount / maxRevenue) * 100

                return (
                    <div key={product.productId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-medium">
                                    {index + 1}
                                </span>
                                <span className="font-medium text-gray-900 truncate max-w-[150px]">
                                    {product.productName}
                                </span>
                            </div>
                            <span className="text-gray-600">
                                {formatMoney(product.revenue.amount)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                            <span className="text-xs text-gray-500 w-16 text-right">
                                {product.quantity} шт.
                            </span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

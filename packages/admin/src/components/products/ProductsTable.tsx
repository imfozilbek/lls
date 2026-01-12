import { formatMoney } from "../../lib/utils.js"
import { AvailabilityBadge } from "../ui/Badge.js"
import { Button } from "../ui/Button.js"
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    TableEmptyState,
} from "../ui/Table.js"

import type { ProductDTO } from "@lls/core"
import type { ReactNode } from "react"

interface ProductsTableProps {
    products: ProductDTO[]
    isLoading: boolean
    onEdit: (product: ProductDTO) => void
    onDelete: (product: ProductDTO) => void
    onToggleAvailability: (productId: string) => void
}

export function ProductsTable({
    products,
    isLoading,
    onEdit,
    onDelete,
    onToggleAvailability,
}: ProductsTableProps): ReactNode {
    return (
        <Table>
            <TableHeader>
                <TableRow hoverable={false}>
                    <TableHead>Товар</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {products.length === 0 ? (
                    <TableEmptyState
                        icon="📦"
                        title="Нет товаров"
                        description="Добавьте первый товар"
                    />
                ) : (
                    products.map((product) => (
                        <TableRow key={product.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    {product.imageUrl ? (
                                        <img
                                            src={product.imageUrl}
                                            alt={product.name}
                                            className="w-10 h-10 rounded-lg object-cover"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                            <span className="text-gray-400 text-lg">📦</span>
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-900">{product.name}</p>
                                        {product.description && (
                                            <p className="text-xs text-gray-500 truncate max-w-[200px]">
                                                {product.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-gray-600">
                                {product.category || "—"}
                            </TableCell>
                            <TableCell className="font-medium">
                                {formatMoney(product.price.amount, product.price.currency)}
                            </TableCell>
                            <TableCell>
                                <button
                                    onClick={(): void => onToggleAvailability(product.id)}
                                    disabled={isLoading}
                                    className="cursor-pointer disabled:cursor-not-allowed"
                                >
                                    <AvailabilityBadge isAvailable={product.isAvailable} />
                                </button>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={(): void => onEdit(product)}
                                    >
                                        Изменить
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        onClick={(): void => onDelete(product)}
                                    >
                                        Удалить
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    )
}

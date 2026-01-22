import { useEffect, useState } from "react"

import { Layout } from "../components/layout/Layout.js"
import { ProductForm, type ProductFormData } from "../components/products/ProductForm.js"
import { ProductsTable } from "../components/products/ProductsTable.js"
import { Button } from "../components/ui/Button.js"
import { Card } from "../components/ui/Card.js"
import { TableSkeleton } from "../components/ui/Loading.js"
import { Modal, ModalFooter } from "../components/ui/Modal.js"
import { useToast } from "../components/ui/Toast.js"
import { useAuthStore } from "../stores/auth.store.js"
import { useProductsStore } from "../stores/products.store.js"

import type { ProductDTO } from "@lls/core"
import type { ReactNode } from "react"

// eslint-disable-next-line max-lines-per-function
export function Products(): ReactNode {
    const toast = useToast()
    const business = useAuthStore((state) => state.business)
    const products = useProductsStore((state) => state.products)
    const isLoading = useProductsStore((state) => state.isLoading)
    const fetchProducts = useProductsStore((state) => state.fetchProducts)
    const createProduct = useProductsStore((state) => state.createProduct)
    const updateProduct = useProductsStore((state) => state.updateProduct)
    const deleteProduct = useProductsStore((state) => state.deleteProduct)
    const toggleAvailability = useProductsStore((state) => state.toggleAvailability)

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<ProductDTO | null>(null)
    const [deletingProduct, setDeletingProduct] = useState<ProductDTO | null>(null)

    useEffect(() => {
        if (business) {
            void fetchProducts(business.id)
        }
    }, [business, fetchProducts])

    const handleCreate = (): void => {
        setEditingProduct(null)
        setIsFormOpen(true)
    }

    const handleEdit = (product: ProductDTO): void => {
        setEditingProduct(product)
        setIsFormOpen(true)
    }

    const handleFormSubmit = async (data: ProductFormData): Promise<void> => {
        if (!business) {
            return
        }

        try {
            if (editingProduct) {
                await updateProduct(editingProduct.id, {
                    name: data.name,
                    description: data.description || undefined,
                    price: { amount: data.price, currency: "UZS" },
                    category: data.category || undefined,
                    imageUrl: data.imageUrl || undefined,
                })
                toast.success(`Товар "${data.name}" успешно обновлён`)
            } else {
                await createProduct({
                    businessId: business.id,
                    name: data.name,
                    description: data.description || undefined,
                    price: { amount: data.price, currency: "UZS" },
                    category: data.category || undefined,
                    imageUrl: data.imageUrl || undefined,
                })
                toast.success(`Товар "${data.name}" добавлен`)
            }

            setIsFormOpen(false)
            setEditingProduct(null)
        } catch {
            toast.error(editingProduct ? "Не удалось обновить товар" : "Не удалось добавить товар")
        }
    }

    const handleDelete = async (): Promise<void> => {
        if (!deletingProduct) {
            return
        }

        try {
            await deleteProduct(deletingProduct.id)
            toast.success(`Товар "${deletingProduct.name}" удалён`)
            setDeletingProduct(null)
        } catch {
            toast.error("Не удалось удалить товар")
        }
    }

    const handleToggleAvailability = async (productId: string): Promise<void> => {
        try {
            await toggleAvailability(productId)
            const product = products.find((p) => p.id === productId)
            if (product) {
                toast.success(
                    product.isAvailable ? "Товар снят с продажи" : "Товар доступен для продажи",
                )
            }
        } catch {
            toast.error("Не удалось изменить доступность")
        }
    }

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">Товары</h1>
                    <Button onClick={handleCreate}>Добавить товар</Button>
                </div>

                {/* Products Table */}
                <Card padding="none">
                    {isLoading && products.length === 0 ? (
                        <div className="p-4">
                            <TableSkeleton rows={5} cols={5} />
                        </div>
                    ) : (
                        <ProductsTable
                            products={products}
                            isLoading={isLoading}
                            onEdit={handleEdit}
                            onDelete={setDeletingProduct}
                            onToggleAvailability={handleToggleAvailability}
                        />
                    )}
                </Card>
            </div>

            {/* Product Form Modal */}
            <ProductForm
                isOpen={isFormOpen}
                onClose={(): void => {
                    setIsFormOpen(false)
                    setEditingProduct(null)
                }}
                onSubmit={handleFormSubmit}
                product={editingProduct}
                isLoading={isLoading}
            />

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deletingProduct !== null}
                onClose={(): void => setDeletingProduct(null)}
                title="Удалить товар?"
                size="sm"
            >
                <p className="text-gray-600">
                    Вы уверены, что хотите удалить товар &quot;{deletingProduct?.name}&quot;? Это
                    действие нельзя отменить.
                </p>
                <ModalFooter>
                    <Button variant="secondary" onClick={(): void => setDeletingProduct(null)}>
                        Отмена
                    </Button>
                    <Button variant="danger" loading={isLoading} onClick={handleDelete}>
                        Удалить
                    </Button>
                </ModalFooter>
            </Modal>
        </Layout>
    )
}

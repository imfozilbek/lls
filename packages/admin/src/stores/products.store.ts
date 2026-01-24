import { create } from "zustand"

import { productApi } from "../lib/api-client.js"

import type { ProductDTO } from "@lls/core"

interface CreateProductInput {
    businessId: string
    name: string
    description?: string
    price: { amount: number; currency: string }
    category?: string
    imageUrl?: string
}

interface UpdateProductInput {
    name?: string
    description?: string
    price?: { amount: number; currency: string }
    category?: string
    imageUrl?: string
    isAvailable?: boolean
}

interface ProductsState {
    products: ProductDTO[]
    selectedProduct: ProductDTO | null
    isLoading: boolean
    error: string | null
    fetchProducts: (businessId: string) => Promise<void>
    createProduct: (data: CreateProductInput) => Promise<ProductDTO>
    updateProduct: (id: string, data: UpdateProductInput) => Promise<ProductDTO>
    deleteProduct: (id: string) => Promise<void>
    toggleAvailability: (id: string) => Promise<void>
    selectProduct: (product: ProductDTO | null) => void
}

export const useProductsStore = create<ProductsState>()((set) => ({
    products: [],
    selectedProduct: null,
    isLoading: false,
    error: null,

    fetchProducts: async (businessId: string): Promise<void> => {
        set({ isLoading: true, error: null })
        try {
            const response = await productApi.listByBusiness(businessId, { limit: 100 })
            set({ products: response.data, isLoading: false })
        } catch (err) {
            const message = err instanceof Error ? err.message : "Не удалось загрузить товары"
            set({ error: message, isLoading: false })
        }
    },

    createProduct: async (data: CreateProductInput): Promise<ProductDTO> => {
        set({ isLoading: true, error: null })
        try {
            const product = await productApi.create(data)
            set((state) => ({
                products: [...state.products, product],
                isLoading: false,
            }))
            return product
        } catch (err) {
            const message = err instanceof Error ? err.message : "Не удалось создать товар"
            set({ error: message, isLoading: false })
            throw err
        }
    },

    updateProduct: async (id: string, data: UpdateProductInput): Promise<ProductDTO> => {
        set({ isLoading: true, error: null })
        try {
            const product = await productApi.update(id, data)
            set((state) => ({
                products: state.products.map((p) => (p.id === id ? product : p)),
                selectedProduct: state.selectedProduct?.id === id ? product : state.selectedProduct,
                isLoading: false,
            }))
            return product
        } catch (err) {
            const message = err instanceof Error ? err.message : "Не удалось обновить товар"
            set({ error: message, isLoading: false })
            throw err
        }
    },

    deleteProduct: async (id: string): Promise<void> => {
        set({ isLoading: true, error: null })
        try {
            await productApi.delete(id)
            set((state) => ({
                products: state.products.filter((p) => p.id !== id),
                selectedProduct: state.selectedProduct?.id === id ? null : state.selectedProduct,
                isLoading: false,
            }))
        } catch (err) {
            const message = err instanceof Error ? err.message : "Не удалось удалить товар"
            set({ error: message, isLoading: false })
            throw err
        }
    },

    toggleAvailability: async (id: string): Promise<void> => {
        set({ isLoading: true, error: null })
        try {
            const product = await productApi.toggleAvailability(id)
            set((state) => ({
                products: state.products.map((p) => (p.id === id ? product : p)),
                isLoading: false,
            }))
        } catch (err) {
            const message = err instanceof Error ? err.message : "Не удалось изменить доступность"
            set({ error: message, isLoading: false })
            throw err
        }
    },

    selectProduct: (product: ProductDTO | null): void => {
        set({ selectedProduct: product })
    },
}))

import type { BusinessDTO, ProductDTO, OrderDTO } from "@lls/core"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api/v1"

function getBusinessTelegramId(): string | null {
    if (typeof window !== "undefined") {
        return localStorage.getItem("business_telegram_id")
    }
    return null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${API_URL}${path}`
    const telegramId = getBusinessTelegramId()

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    }

    if (telegramId) {
        headers["X-Business-Telegram-Id"] = telegramId
    }

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Request failed" }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    const result = await response.json()
    return result.data as T
}

export const api = {
    get: <T>(path: string): Promise<T> => request<T>("GET", path),
    post: <T>(path: string, body?: unknown): Promise<T> => request<T>("POST", path, body),
    patch: <T>(path: string, body?: unknown): Promise<T> => request<T>("PATCH", path, body),
    delete: <T>(path: string): Promise<T> => request<T>("DELETE", path),
}

// Business API
export const businessApi = {
    getByTelegramId: (telegramId: number): Promise<BusinessDTO> =>
        api.get(`/businesses/telegram/${telegramId}`),
    update: (id: string, data: Partial<BusinessDTO>): Promise<BusinessDTO> =>
        api.patch(`/businesses/${id}`, data),
}

// Product API
export const productApi = {
    listByBusiness: (businessId: string): Promise<ProductDTO[]> =>
        api.get(`/businesses/${businessId}/products`),
    create: (data: {
        businessId: string
        name: string
        description?: string
        price: { amount: number; currency: string }
        category?: string
        imageUrl?: string
    }): Promise<ProductDTO> => api.post("/products", data),
    update: (
        id: string,
        data: {
            name?: string
            description?: string
            price?: { amount: number; currency: string }
            category?: string
            imageUrl?: string
            isAvailable?: boolean
        },
    ): Promise<ProductDTO> => api.patch(`/products/${id}`, data),
    delete: (id: string): Promise<void> => api.delete(`/products/${id}`),
    toggleAvailability: (id: string): Promise<ProductDTO> =>
        api.post(`/products/${id}/toggle-availability`),
}

// Order API for business
export const orderApi = {
    listByBusiness: (businessId: string, status?: string): Promise<OrderDTO[]> => {
        const query = status ? `?status=${status}` : ""
        return api.get(`/businesses/${businessId}/orders${query}`)
    },
    getById: (id: string): Promise<OrderDTO> => api.get(`/orders/${id}`),
    updateStatus: (id: string, status: string): Promise<OrderDTO> =>
        api.patch(`/orders/${id}/status`, { status }),
}

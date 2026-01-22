const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api/v1"

function getInitData(): string {
    if (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) {
        return window.Telegram.WebApp.initData
    }
    return ""
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${API_URL}${path}`
    const initData = getInitData()

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    }

    if (initData) {
        headers["X-Telegram-Init-Data"] = initData
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

// Typed API methods
import type { BusinessDTO, ProductDTO, OrderDTO, CustomerDTO } from "@lls/core"

export const businessApi = {
    list: (): Promise<BusinessDTO[]> => api.get("/businesses"),
    getById: (id: string): Promise<BusinessDTO> => api.get(`/businesses/${id}`),
}

export const productApi = {
    listByBusiness: (businessId: string): Promise<ProductDTO[]> =>
        api.get(`/businesses/${businessId}/products`),
}

export const orderApi = {
    create: (data: {
        customerId: string
        businessId: string
        items: Array<{
            productId: string
            productName: string
            quantity: number
            unitPrice: { amount: number; currency: string }
        }>
        deliveryAddress: { street: string; city: string }
    }): Promise<OrderDTO> => api.post("/orders", data),
    getById: (id: string): Promise<OrderDTO> => api.get(`/orders/${id}`),
    getMyOrders: (): Promise<OrderDTO[]> => api.get("/orders/my"),
    cancel: (id: string): Promise<OrderDTO> => api.post(`/orders/${id}/cancel`),
}

export const customerApi = {
    getOrCreate: (telegramData: {
        telegramId: number
        name: string
        phone: string
        address: { street: string; city: string }
    }): Promise<CustomerDTO> => api.post("/customers/telegram", telegramData),
    getMe: (): Promise<CustomerDTO> => api.get("/customers/me"),
    updateMe: (data: {
        name?: string
        phone?: string
        address?: { street: string; city: string }
    }): Promise<CustomerDTO> => api.patch("/customers/me", data),
}

export const courierApi = {
    getAvailableOrders: (): Promise<OrderDTO[]> => api.get("/couriers/available-orders"),
    takeOrder: (orderId: string): Promise<OrderDTO> => api.post(`/orders/${orderId}/take`),
    completeDelivery: (orderId: string): Promise<OrderDTO> =>
        api.post(`/orders/${orderId}/complete`),
    getMyOrders: (): Promise<OrderDTO[]> => api.get("/couriers/my-orders"),
}

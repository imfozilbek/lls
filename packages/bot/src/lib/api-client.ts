import { env } from "./env.js"
import { logger } from "./logger.js"

const log = logger.child("api")

/**
 * HTTP Error types for proper handling
 */
export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly code?: string,
    ) {
        super(message)
        this.name = "ApiError"
    }

    get isUnauthorized(): boolean {
        return this.status === 401
    }

    get isForbidden(): boolean {
        return this.status === 403
    }

    get isNotFound(): boolean {
        return this.status === 404
    }

    get isServerError(): boolean {
        return this.status >= 500
    }
}

function getInitData(): string {
    if (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) {
        return window.Telegram.WebApp.initData
    }
    return ""
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${env.apiUrl}${path}`
    const initData = getInitData()

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    }

    if (initData) {
        headers["X-Telegram-Init-Data"] = initData
    }

    try {
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: "Request failed" }))
            const apiError = new ApiError(
                response.status,
                error.message || `HTTP ${response.status}`,
                error.code,
            )

            // Log errors appropriately
            if (apiError.isServerError) {
                log.error(`Server error on ${method} ${path}`, { status: response.status })
            } else if (apiError.isUnauthorized) {
                log.warn(`Unauthorized request to ${path}`)
            } else if (apiError.isForbidden) {
                log.warn(`Forbidden request to ${path}`)
            }

            throw apiError
        }

        const result = await response.json()
        return result.data as T
    } catch (error) {
        if (error instanceof ApiError) {
            throw error
        }
        // Network error or other issues
        log.error(`Network error on ${method} ${path}`, { error })
        throw new ApiError(0, "Network error. Please check your connection.")
    }
}

export const api = {
    get: <T>(path: string): Promise<T> => request<T>("GET", path),
    post: <T>(path: string, body?: unknown): Promise<T> => request<T>("POST", path, body),
    patch: <T>(path: string, body?: unknown): Promise<T> => request<T>("PATCH", path, body),
    delete: <T>(path: string): Promise<T> => request<T>("DELETE", path),
}

// Typed API methods
import type { BusinessDTO, ProductDTO, OrderDTO, CustomerDTO } from "@lls/core"

export interface PaginatedResponse<T> {
    data: T[]
    meta: {
        page: number
        limit: number
        total: number
        totalPages: number
        hasNext: boolean
        hasPrev: boolean
    }
}

export const businessApi = {
    list: (): Promise<BusinessDTO[]> => api.get("/businesses"),
    getById: (id: string): Promise<BusinessDTO> => api.get(`/businesses/${id}`),
}

export const productApi = {
    listByBusiness: async (
        businessId: string,
        page = 1,
        limit = 50,
    ): Promise<PaginatedResponse<ProductDTO>> => {
        return api.get(`/businesses/${businessId}/products?page=${page}&limit=${limit}`)
    },
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

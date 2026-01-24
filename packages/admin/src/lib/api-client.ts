import { env } from "./env.js"

import type {
    BusinessDTO,
    ProductDTO,
    OrderDTO,
    AnalyticsDashboardDTO,
    AnalyticsPeriod,
    SalesChartDTO,
    TopProductsDTO,
} from "@lls/core"

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

function getBusinessTelegramId(): string | null {
    if (typeof window !== "undefined") {
        return localStorage.getItem("business_telegram_id")
    }
    return null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${env.apiUrl}${path}`
    const telegramId = getBusinessTelegramId()

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    }

    if (telegramId) {
        headers["X-Business-Telegram-Id"] = telegramId
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

            // Handle specific error cases
            if (apiError.isUnauthorized) {
                // Clear auth and redirect to login
                localStorage.removeItem("business_telegram_id")
                localStorage.removeItem("business_id")
                window.location.href = "/login"
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
        throw new ApiError(0, "Network error. Please check your connection.")
    }
}

export const api = {
    get: <T>(path: string): Promise<T> => request<T>("GET", path),
    post: <T>(path: string, body?: unknown): Promise<T> => request<T>("POST", path, body),
    patch: <T>(path: string, body?: unknown): Promise<T> => request<T>("PATCH", path, body),
    delete: <T>(path: string): Promise<T> => request<T>("DELETE", path),
}

// Telegram login data interface
export interface TelegramLoginData {
    id: number
    first_name: string
    last_name?: string
    username?: string
    photo_url?: string
    auth_date: number
    hash: string
}

// Pagination interfaces
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

export interface PaginationParams {
    page?: number
    limit?: number
}

// Business API
export const businessApi = {
    getByTelegramId: (telegramId: number): Promise<BusinessDTO> =>
        api.get(`/businesses/telegram/${telegramId}`),
    authenticateWithTelegram: (data: TelegramLoginData): Promise<BusinessDTO> =>
        api.post("/businesses/auth/telegram", data),
    update: (id: string, data: Partial<BusinessDTO>): Promise<BusinessDTO> =>
        api.patch(`/businesses/${id}`, data),
}

// Product API
export const productApi = {
    listByBusiness: (
        businessId: string,
        pagination?: PaginationParams,
    ): Promise<PaginatedResponse<ProductDTO>> => {
        const params = new URLSearchParams()
        if (pagination?.page) {
            params.set("page", String(pagination.page))
        }
        if (pagination?.limit) {
            params.set("limit", String(pagination.limit))
        }
        const query = params.toString() ? `?${params.toString()}` : ""
        return api.get(`/businesses/${businessId}/products${query}`)
    },
    create: (data: {
        businessId: string
        name: string
        description?: string
        price: { amount: number; currency: string }
        category?: string
        imageUrl?: string
    }): Promise<ProductDTO> => api.post(`/businesses/${data.businessId}/products`, data),
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
        api.patch(`/products/${id}/availability`),
}

// Order API for business
export const orderApi = {
    listByBusiness: (
        businessId: string,
        status?: string,
        pagination?: PaginationParams,
    ): Promise<PaginatedResponse<OrderDTO>> => {
        const params = new URLSearchParams()
        if (status) {
            params.set("status", status)
        }
        if (pagination?.page) {
            params.set("page", String(pagination.page))
        }
        if (pagination?.limit) {
            params.set("limit", String(pagination.limit))
        }
        const query = params.toString() ? `?${params.toString()}` : ""
        return api.get(`/businesses/${businessId}/orders${query}`)
    },
    getById: (id: string): Promise<OrderDTO> => api.get(`/orders/${id}`),
    updateStatus: (id: string, status: string): Promise<OrderDTO> =>
        api.patch(`/orders/${id}/status`, { status }),
}

// Analytics API
export const analyticsApi = {
    getDashboard: (
        businessId: string,
        period: AnalyticsPeriod = "week",
    ): Promise<AnalyticsDashboardDTO> =>
        api.get(`/analytics/business/${businessId}?period=${period}`),
    getSales: (businessId: string, period: AnalyticsPeriod = "week"): Promise<SalesChartDTO> =>
        api.get(`/analytics/business/${businessId}/sales?period=${period}`),
    getTopProducts: (
        businessId: string,
        period: AnalyticsPeriod = "week",
        limit = 5,
    ): Promise<TopProductsDTO> =>
        api.get(`/analytics/business/${businessId}/top-products?period=${period}&limit=${limit}`),
}

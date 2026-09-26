import { webApp } from "./telegram.js"

import type { Shop } from "../stores/session.js"
import type {
    CourierDTO,
    CustomerDTO,
    OrderDTO,
    Page,
    ProductDTO,
    ShopOwnerDTO,
    ShopStatsDTO,
} from "@lls/core"

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8787"

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        /** Server error code, e.g. PHONE_REQUIRED, or NETWORK when the request never arrived. */
        public readonly code: string,
        message: string,
    ) {
        super(message)
        this.name = "ApiError"
    }
}

interface ErrorBody {
    error?: { code?: string; message?: string }
}

let currentShop: string | null = null

/** Every request carries the shop from the launch URL, so the Worker verifies with its bot token. */
export function setShop(slug: string | null): void {
    currentShop = slug
}

async function request<T>(method: string, path: string, body?: BodyInit | object): Promise<T> {
    const headers = new Headers({ "X-Telegram-Init-Data": webApp()?.initData ?? "" })
    if (currentShop) {
        headers.set("X-Shop", currentShop)
    }
    let payload: BodyInit | undefined
    if (body instanceof Blob) {
        headers.set("Content-Type", body.type)
        payload = body
    } else if (body !== undefined) {
        headers.set("Content-Type", "application/json")
        payload = JSON.stringify(body)
    }

    let response: Response
    try {
        response = await fetch(`${API_URL}${path}`, { method, headers, body: payload })
    } catch {
        throw new ApiError(0, "NETWORK", "No connection")
    }

    if (response.status === 204) {
        return undefined as T
    }
    const data = (await response.json().catch(() => null)) as T | ErrorBody | null
    if (!response.ok) {
        const error = (data as ErrorBody | null)?.error
        throw new ApiError(
            response.status,
            error?.code ?? "HTTP_ERROR",
            error?.message ?? response.statusText,
        )
    }
    return data as T
}

function query(params: Record<string, string | number | undefined>): string {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
            search.set(key, String(value))
        }
    }
    const text = search.toString()
    return text ? `?${text}` : ""
}

export function imageUrl(key: string | undefined): string | undefined {
    return key ? `${API_URL}/img/${key}` : undefined
}

export interface OrderLine {
    productId: string
    quantity: number
}

export interface PlaceOrderBody {
    items: OrderLine[]
    address: string
    landmark?: string
    location?: { latitude: number; longitude: number }
    comment?: string
    bottlesReturned?: number
}

export type ShopPatch = Partial<{
    name: string
    brandColor: string
    address: string | null
    location: { latitude: number; longitude: number } | null
    delivery: {
        fee: number
        freeFrom?: number | null
        minOrder?: number | null
        radiusMeters?: number | null
    }
    workingHours: Record<string, { open: string; close: string }> | null
    acceptingOrders: boolean
    features: string[]
    bottleDeposit: number
}>

export interface ProductInput {
    name: string
    description?: string
    price: number
    unit: string
    category: string
    step?: number
    returnable?: boolean
    position?: number
}

export interface RegisterShopBody {
    botToken: string
    name: string
    type: string
    address?: string
    deliveryFee: number
    freeDeliveryFrom?: number
    minOrder?: number
}

export interface CourierInvite {
    link: string
    expiresAt: string
}

export const api = {
    shop: (): Promise<Shop> => request("GET", "/api/shop"),
    products: (page = 1): Promise<Page<ProductDTO>> =>
        request("GET", `/api/shop/products${query({ page, limit: 100 })}`),
    me: (): Promise<CustomerDTO> => request("GET", "/api/me"),
    setLanguage: (language: string): Promise<CustomerDTO> =>
        request("PATCH", "/api/me", { language }),
    placeOrder: (body: PlaceOrderBody): Promise<OrderDTO> => request("POST", "/api/orders", body),
    myOrders: (page = 1): Promise<Page<OrderDTO>> =>
        request("GET", `/api/orders${query({ page })}`),
    order: (id: string): Promise<OrderDTO> => request("GET", `/api/orders/${id}`),
    cancelOrder: (id: string): Promise<OrderDTO> =>
        request("PATCH", `/api/orders/${id}`, { status: "cancelled" }),

    owner: {
        shop: (): Promise<ShopOwnerDTO> => request("GET", "/api/owner/shop"),
        updateShop: (patch: ShopPatch): Promise<ShopOwnerDTO> =>
            request("PATCH", "/api/owner/shop", patch),
        uploadLogo: (image: Blob): Promise<ShopOwnerDTO> =>
            request("PUT", "/api/owner/shop/logo", image),
        stats: (): Promise<ShopStatsDTO> => request("GET", "/api/owner/stats"),
        orders: (filter: "active" | "done", page = 1): Promise<Page<OrderDTO>> =>
            request("GET", `/api/owner/orders${query({ filter, page })}`),
        setStatus: (id: string, status: string, reason?: string): Promise<OrderDTO> =>
            request("PATCH", `/api/owner/orders/${id}`, { status, reason }),
        products: (page = 1): Promise<Page<ProductDTO>> =>
            request("GET", `/api/owner/products${query({ page, limit: 100 })}`),
        createProduct: (input: ProductInput): Promise<ProductDTO> =>
            request("POST", "/api/owner/products", input),
        updateProduct: (
            id: string,
            patch: Omit<Partial<ProductInput>, "description"> & {
                isAvailable?: boolean
                stopForToday?: true
                description?: string | null
            },
        ): Promise<ProductDTO> => request("PATCH", `/api/owner/products/${id}`, patch),
        deleteProduct: (id: string): Promise<void> =>
            request("DELETE", `/api/owner/products/${id}`),
        uploadProductImage: (id: string, image: Blob): Promise<ProductDTO> =>
            request("PUT", `/api/owner/products/${id}/image`, image),
        removeProductImage: (id: string): Promise<ProductDTO> =>
            request("DELETE", `/api/owner/products/${id}/image`),
        couriers: (): Promise<CourierDTO[]> => request("GET", "/api/owner/couriers"),
        inviteCourier: (): Promise<CourierInvite> => request("POST", "/api/owner/couriers/invites"),
        removeCourier: (id: string): Promise<void> =>
            request("DELETE", `/api/owner/couriers/${id}`),
        assignCourier: (orderId: string, courierId: string): Promise<OrderDTO> =>
            request("PUT", `/api/owner/orders/${orderId}/courier`, { courierId }),
    },

    courier: {
        orders: (): Promise<{ data: OrderDTO[] }> => request("GET", "/api/courier/orders"),
        setStatus: (id: string, status: "picked_up" | "delivered"): Promise<OrderDTO> =>
            request("PATCH", `/api/courier/orders/${id}`, { status }),
    },

    platform: {
        myShops: (): Promise<ShopOwnerDTO[]> => request("GET", "/api/platform/shops"),
        register: (body: RegisterShopBody): Promise<ShopOwnerDTO> =>
            request("POST", "/api/platform/shops", body),
    },
}

/** Safety cap: 20 pages × 100 = 2000 products, far above a small shop's menu. */
const MAX_PAGES = 20

/** Loads every page of a list. Menus are small, so the whole catalog comes at once. */
export async function fetchAll<T>(load: (page: number) => Promise<Page<T>>): Promise<T[]> {
    const items: T[] = []
    for (let page = 1; page <= MAX_PAGES; page++) {
        const result = await load(page)
        items.push(...result.data)
        if (result.data.length === 0 || items.length >= result.meta.total) {
            break
        }
    }
    return items
}

/** The storefront: every available product of the current shop. */
export const loadCatalog = (): Promise<ProductDTO[]> => fetchAll((page) => api.products(page))

/** The owner's menu, hidden products included. */
export const loadOwnerProducts = (): Promise<ProductDTO[]> =>
    fetchAll((page) => api.owner.products(page))

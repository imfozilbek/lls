import { webApp } from "./telegram.js"

import type { Shop } from "../stores/session.js"
import type {
    CourierDTO,
    CourierHomeDTO,
    CourierProfileDTO,
    Weekday,
    CustomerDTO,
    OrderDTO,
    Page,
    PayoutCardsDTO,
    ProductDTO,
    ShopOwnerDTO,
    MoneyPeriod,
    MoneyReportDTO,
    ShopPublicDTO,
    ShowcaseProductDTO,
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
let viaShowcase = false
let courierBot = false

/**
 * Every request carries the shop, so the Worker verifies with the right bot token: the shop's own
 * bot, or the LLS bot when the shop was opened from the showcase (`viaShowcase`).
 */
export function setShop(slug: string | null, options: { viaShowcase?: boolean } = {}): void {
    currentShop = slug
    viaShowcase = options.viaShowcase ?? false
    courierBot = false
}

/** Opened from the LLS courier bot: no shop; the courier bot's token signed the request. */
export function setCourierBot(): void {
    currentShop = null
    viaShowcase = false
    courierBot = true
}

function authHeaders(): Headers {
    const headers = new Headers({ "X-Telegram-Init-Data": webApp()?.initData ?? "" })
    if (courierBot) {
        headers.set("X-Bot", "courier")
    }
    if (currentShop) {
        headers.set("X-Shop", currentShop)
        if (viaShowcase) {
            headers.set("X-Via", "marketplace")
        }
    }
    return headers
}

async function request<T>(method: string, path: string, body?: BodyInit | object): Promise<T> {
    const headers = authHeaders()
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
    networkDelivery: boolean
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
    /** Customers pay only by transfer: the card is a required step. */
    payoutCard: { number: string; holder: string }
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
    /** «Я перевёл»: the owner gets a ping to check the card. */
    transferSent: (id: string): Promise<OrderDTO> =>
        request("POST", `/api/orders/${id}/transfer-sent`),

    owner: {
        shop: (): Promise<ShopOwnerDTO> => request("GET", "/api/owner/shop"),
        updateShop: (patch: ShopPatch): Promise<ShopOwnerDTO> =>
            request("PATCH", "/api/owner/shop", patch),
        uploadLogo: (image: Blob): Promise<ShopOwnerDTO> =>
            request("PUT", "/api/owner/shop/logo", image),
        money: (period: MoneyPeriod): Promise<MoneyReportDTO> =>
            request("GET", `/api/owner/money${query({ period })}`),
        /** The bot sends the period's orders to the owner's chat as a CSV file. */
        exportMoney: (period: MoneyPeriod): Promise<{ sent: number }> =>
            request("POST", `/api/owner/money/export${query({ period })}`),
        /** The shop's cards and the one customers are shown. */
        cards: (): Promise<PayoutCardsDTO> => request("GET", "/api/owner/shop/cards"),
        addCard: (card: { number: string; holder: string }): Promise<PayoutCardsDTO> =>
            request("POST", "/api/owner/shop/cards", card),
        choosePaymentCard: (id: string): Promise<PayoutCardsDTO> =>
            request("PUT", `/api/owner/shop/cards/${id}/payment`),
        removeCard: (id: string): Promise<void> => request("DELETE", `/api/owner/shop/cards/${id}`),
        /** «Деньги пришли — принять»: paid, and a new order is accepted in the same tap. */
        confirmPayment: (orderId: string): Promise<OrderDTO> =>
            request("PATCH", `/api/owner/orders/${orderId}/payment`, { action: "paid" }),
        markRefunded: (orderId: string): Promise<OrderDTO> =>
            request("PATCH", `/api/owner/orders/${orderId}/payment`, { action: "refunded" }),
        /** The bot sends the QR poster back to the owner's chat. */
        sendPoster: (png: Blob): Promise<{ sent: boolean }> =>
            request("POST", "/api/owner/shop/poster", png),
        orders: (filter: "active" | "done", page = 1): Promise<Page<OrderDTO>> =>
            request("GET", `/api/owner/orders${query({ filter, page })}`),
        setStatus: (
            id: string,
            status: string,
            extra: { reason?: string } = {},
        ): Promise<OrderDTO> => request("PATCH", `/api/owner/orders/${id}`, { status, ...extra }),
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
        /** «Доставщик сети района»: the first free courier of the district takes it. */
        toNetwork: (orderId: string): Promise<OrderDTO> =>
            request("PUT", `/api/owner/orders/${orderId}/network`),
        reviewCourier: (id: string, approve: boolean): Promise<CourierDTO> =>
            request("POST", `/api/owner/couriers/${id}/review`, { approve }),
        setCourierSchedule: (
            id: string,
            patch: { workDays?: Weekday[]; offToday?: boolean },
        ): Promise<CourierDTO> => request("PATCH", `/api/owner/couriers/${id}`, patch),
    },

    /** The LLS courier bot's screen (`setCourierBot`): every shop the courier works for. */
    courier: {
        home: (): Promise<CourierHomeDTO> => request("GET", "/api/courier/home"),
        setStatus: (id: string, status: "picked_up" | "delivered"): Promise<OrderDTO> =>
            request("PATCH", `/api/courier/orders/${id}`, { status }),
        shift: (onShift: boolean): Promise<CourierProfileDTO> =>
            request("PUT", "/api/courier/shift", { onShift }),
        profile: (vehicle: string | null): Promise<CourierProfileDTO> =>
            request("PATCH", "/api/courier/profile", { vehicle }),
        network: (inNetwork: boolean): Promise<CourierProfileDTO> =>
            request("PUT", "/api/courier/network", { inNetwork }),
        /** «Беру»: the order is theirs, or NETWORK_ORDER_TAKEN when someone was faster. */
        claim: (orderId: string): Promise<OrderDTO> =>
            request("POST", `/api/courier/network/orders/${orderId}/claim`),
    },

    showcase: {
        shops: (): Promise<Page<ShopPublicDTO>> => request("GET", "/api/showcase/shops"),
        search: (
            query: { q?: string; category?: string },
            page: number,
        ): Promise<Page<ShowcaseProductDTO>> => {
            const params = new URLSearchParams({ page: String(page) })
            if (query.q) {
                params.set("q", query.q)
            }
            if (query.category) {
                params.set("category", query.category)
            }
            return request("GET", `/api/showcase/products?${params.toString()}`)
        },
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

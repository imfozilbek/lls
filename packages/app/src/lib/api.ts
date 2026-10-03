import { webApp } from "./telegram.js"

import type { Shop } from "../stores/session.js"
import type {
    BusinessStatus,
    DistrictStats,
    PlatformShopDTO,
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
} from "@zumda/core"

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

/**
 * Which Zumda bot opened the app around the shop: the customers' Zumda bot (`marketplace`, the
 * showcase), or Zumda Business (`business`: «Mening bizneslarim», and an owner's own shop).
 * Absent: the shop's own bot.
 */
export type ShopVia = "marketplace" | "business"

let currentShop: string | null = null
let currentVia: ShopVia | null = null
let courierBot = false
/** Zumda | Business in a browser: the session from the Telegram Login Widget. */
let webSession: string | null = null

let onSessionExpired: (() => void) | null = null

/** Outside Telegram: every request carries the session instead of initData. */
export function setWebSession(token: string | null): void {
    webSession = token
}

/** The browser session ran out (30 days): back to «Telegram orqali kirish». */
export function onWebSessionExpired(handler: (() => void) | null): void {
    onSessionExpired = handler
}

/**
 * Every request carries the shop, so the Worker verifies with the right bot token: the shop's own
 * bot, or the Zumda bot that opened it (`via`). Zumda Business also works with no shop (`null`).
 */
export function setShop(slug: string | null, options: { via?: ShopVia } = {}): void {
    currentShop = slug
    currentVia = options.via ?? null
    courierBot = false
}

/** Opened from the Zumda courier bot: no shop; the courier bot's token signed the request. */
export function setCourierBot(): void {
    currentShop = null
    currentVia = null
    courierBot = true
}

function authHeaders(): Headers {
    const headers = new Headers({ "X-Telegram-Init-Data": webApp()?.initData ?? "" })
    if (webSession) {
        headers.set("Authorization", `Bearer ${webSession}`)
    }
    if (courierBot) {
        headers.set("X-Bot", "courier")
    } else if (currentVia === "business") {
        headers.set("X-Bot", "business")
    }
    if (currentShop) {
        headers.set("X-Shop", currentShop)
        if (currentVia === "marketplace") {
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
    if (response.status === 401 && webSession) {
        onSessionExpired?.()
    }
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

/** A private file the Worker streams (the transfer screenshot): read as a Blob, never cached. */
async function requestBlob(path: string): Promise<Blob> {
    let response: Response
    try {
        response = await fetch(`${API_URL}${path}`, { headers: authHeaders(), cache: "no-store" })
    } catch {
        throw new ApiError(0, "NETWORK", "No connection")
    }
    if (!response.ok) {
        if (response.status === 401 && webSession) {
            onSessionExpired?.()
        }
        const error = ((await response.json().catch(() => null)) as ErrorBody | null)?.error
        throw new ApiError(
            response.status,
            error?.code ?? "HTTP_ERROR",
            error?.message ?? response.statusText,
        )
    }
    return response.blob()
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

/** A browser session of Zumda | Business. */
export interface WebSession {
    token: string
    expiresAt: string
    user: { id: number; firstName: string }
}

/** Step «Bot»: `preparedId` for `WebApp.requestChat`, `link` for older Telegram apps. */
export interface PreparedManagedBot {
    preparedId: string
    link: string
}

/** A bot the owner created from the Zumda bot; Zumda holds its token, the owner never sees it. */
export interface ManagedBot {
    botId: number
    username: string
}

/** The application's bot: exactly one of a pasted token or a managed bot. */
export type RegisterShopBot = { botToken: string } | { managedBotId: number }

export type RegisterShopBody = RegisterShopBot & {
    name: string
    type: string
    address?: string
    location?: { latitude: number; longitude: number }
    /** The fee and the card come later, in «Ishga tayyor». */
    deliveryFee?: number
    payoutCard?: { number: string; holder: string }
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
    /** «O'tkazdim» with the screenshot of the transfer: the owner gets it to check the card. */
    transferSent: (id: string, receipt: Blob): Promise<OrderDTO> =>
        request("POST", `/api/orders/${id}/transfer-sent`, receipt),
    /** The screenshot sent with «O'tkazdim»: only the order's customer and the shop's owner. */
    orderReceipt: (id: string): Promise<Blob> => requestBlob(`/api/orders/${id}/receipt`),

    owner: {
        shop: (): Promise<ShopOwnerDTO> => request("GET", "/api/owner/shop"),
        /** A rejected application, fixed, goes to Zumda again. */
        resubmit: (): Promise<ShopOwnerDTO> => request("POST", "/api/owner/shop/resubmit"),
        updateShop: (patch: ShopPatch): Promise<ShopOwnerDTO> =>
            request("PATCH", "/api/owner/shop", patch),
        uploadLogo: (image: Blob): Promise<ShopOwnerDTO> =>
            request("PUT", "/api/owner/shop/logo", image),
        /** Zumda's picture on the shop bot (`lib/bot-avatar.ts`). */
        setBotPhoto: (jpeg: Blob): Promise<void> =>
            request("PUT", "/api/owner/shop/bot-photo", jpeg),
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
        /** «Деньги пришли, принять»: paid, and a new order is accepted in the same tap. */
        confirmPayment: (orderId: string): Promise<OrderDTO> =>
            request("PATCH", `/api/owner/orders/${orderId}/payment`, { action: "paid" }),
        /** «Pul kelmadi»: the money is not on the card; the customer sends the screenshot again. */
        rejectTransfer: (orderId: string): Promise<OrderDTO> =>
            request("PATCH", `/api/owner/orders/${orderId}/payment`, { action: "rejected" }),
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

    /** The Zumda courier bot's screen (`setCourierBot`): every shop the courier works for. */
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

    business: {
        /** What Telegram's login window needs: the bot's Client ID and our nonce. */
        login: (): Promise<{ clientId: number; nonce: string }> =>
            request("GET", "/api/business/login"),
        /** Telegram Login's `id_token` in, a session out (business.zumda.shop). */
        signIn: (idToken: string): Promise<WebSession> =>
            request("POST", "/api/business/session", { idToken }),
    },

    platform: {
        /** Who opened Zumda | Business: a platform admin also gets «Platforma». */
        me: (): Promise<{ admin: boolean }> => request("GET", "/api/platform/me"),
        myShops: (): Promise<ShopOwnerDTO[]> => request("GET", "/api/platform/shops"),
        register: (body: RegisterShopBody): Promise<ShopOwnerDTO> =>
            request("POST", "/api/platform/shops", body),
        /** Step «Bot»: the prepared «create a bot» window and the t.me/newbot link. */
        prepareManagedBot: (name: string): Promise<PreparedManagedBot> =>
            request("POST", "/api/platform/managed-bot/prepare", { name }),
        /** Bots the owner created from Zumda that no application took yet. */
        managedBots: async (): Promise<ManagedBot[]> =>
            (await request<{ data: ManagedBot[] }>("GET", "/api/platform/managed-bots")).data,
        /** The new bot's first picture: the shop's name with the Zumda mark. */
        setBotPhoto: (shopId: string, jpeg: Blob): Promise<void> =>
            request("PUT", `/api/platform/shops/${shopId}/bot-photo`, jpeg),
    },
}

/** What «Platforma» does to a shop: what came back, and whether its bot answers now. */
export interface AdminShopResult {
    shop: Omit<ShopOwnerDTO, "payoutCard">
    bot: { connected: true } | { connected: false; reason: string } | null
}

export interface DistrictInput {
    name: string
    center?: { latitude: number; longitude: number }
    radiusKm?: number
    waitMinutes?: number
}

/** «Platforma»: platform admins only (the Worker checks it on every call). */
export const adminApi = {
    shops: async (status: BusinessStatus): Promise<PlatformShopDTO[]> =>
        (await request<Page<PlatformShopDTO>>("GET", `/api/admin/shops?status=${status}`)).data,
    /** `reason`: why an application is rejected; the owner reads it. */
    review: (
        id: string,
        decision: "approve" | "reject",
        reason?: string,
    ): Promise<AdminShopResult> => request("PATCH", `/api/admin/shops/${id}`, { decision, reason }),
    reconnect: (id: string): Promise<AdminShopResult> =>
        request("POST", `/api/admin/shops/${id}/reconnect`),
    /** The showcase deal in percent, or `null` to take the shop out. */
    marketplace: (id: string, percent: number | null): Promise<AdminShopResult> =>
        request("PUT", `/api/admin/shops/${id}/marketplace`, { percent }),
    districts: async (): Promise<DistrictStats[]> =>
        (await request<Page<DistrictStats>>("GET", "/api/admin/districts")).data,
    saveDistrict: (body: DistrictInput): Promise<unknown> =>
        request("PUT", "/api/admin/districts", body),
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

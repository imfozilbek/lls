import {
    BUSINESS_STATUSES,
    BUSINESS_TYPES,
    CATEGORIES,
    FEATURES,
    LANGUAGES,
    MONEY_PERIODS,
    ORDER_STATUSES,
    OrderStatus,
    UNITS,
    WEEKDAYS,
} from "@zumda/core"
import { z } from "zod"

import type { Context } from "hono"

const money = z.number().int().min(0).max(1_000_000_000)
const optionalMoney = money.nullable().optional()
const text = (max: number): z.ZodString => z.string().trim().min(1).max(max)

export const locationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
})

export const pageQuery = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
})

export const productsQuery = pageQuery.extend({ category: z.enum(CATEGORIES).optional() })

/** Showcase search: free text (any alphabet) and/or a shared category. */
/** Deep pages cost D1 reads for nothing: nobody scrolls past 50 pages of search results. */
const MAX_SHOWCASE_PAGE = 50

export const showcaseQuery = productsQuery.extend({
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().positive().max(MAX_SHOWCASE_PAGE).optional(),
})

export const ownerOrdersQuery = pageQuery.extend({
    filter: z.enum(["active", "done", "all"]).optional(),
})

export const idParam = z.object({ id: z.string().min(1).max(64) })

export const meBody = z.object({ language: z.enum(LANGUAGES) })

export const placeOrderBody = z.object({
    items: z
        .array(
            z.object({
                productId: z.string().min(1).max(64),
                // Pieces, or grams for weight items; the product checks its own step.
                quantity: z.number().int().min(1).max(1_000_000),
            }),
        )
        .min(1)
        .max(50),
    address: text(200),
    landmark: z.string().trim().max(200).optional(),
    location: locationSchema.optional(),
    comment: z.string().trim().max(300).optional(),
    bottlesReturned: z.number().int().min(0).max(99).optional(),
})

export const customerCancelBody = z.object({
    status: z.literal("cancelled"),
    reason: z.string().trim().max(200).optional(),
})

export const ownerOrderBody = z.object({
    status: z.enum(ORDER_STATUSES),
    reason: z.string().trim().max(200).optional(),
})

export const productBody = z.object({
    name: text(80),
    description: z.string().trim().max(500).optional(),
    price: z.number().int().min(1).max(100_000_000),
    unit: z.enum(UNITS),
    category: z.enum(CATEGORIES),
    step: z.number().int().min(10).max(10_000).optional(),
    returnable: z.boolean().optional(),
    position: z.number().int().min(0).max(100_000).optional(),
})

export const productPatchBody = productBody.partial().extend({
    description: z.string().trim().max(500).nullable().optional(),
    isAvailable: z.boolean().optional(),
    stopForToday: z.literal(true).optional(),
})

export const assignCourierBody = z.object({ courierId: z.string().min(1).max(64) })

/** The owner's week for a courier and "сегодня не работает"; at least one of them. */
export const courierSchedulePatch = z
    .object({
        workDays: z.array(z.enum(WEEKDAYS)).min(1).max(WEEKDAYS.length).optional(),
        offToday: z.boolean().optional(),
    })
    .refine((patch) => patch.workDays !== undefined || patch.offToday !== undefined, {
        message: "Nothing to change",
    })

export const courierReviewBody = z.object({ approve: z.boolean() })

export const shiftBody = z.object({ onShift: z.boolean() })

export const networkMembershipBody = z.object({ inNetwork: z.boolean() })

export const courierProfileBody = z.object({
    vehicle: z.string().trim().max(40).nullable(),
})

/** A courier moves only the delivery part. */
export const courierOrderBody = z.object({
    status: z.enum([OrderStatus.PICKED_UP, OrderStatus.DELIVERED]),
})

/**
 * «Деньги пришли, принять»: the transfer arrived (a new order is accepted in the same tap);
 * or «Вернул»: the money of a cancelled order went back.
 */
export const paymentBody = z.object({ action: z.enum(["paid", "refunded"]) })

export const moneyQuery = z.object({ period: z.enum(MONEY_PERIODS).default("today") })

const timeRange = z.object({
    open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
})

/** One of the shop's cards for customers' transfers. */
export const payoutCardBody = z.object({
    number: z.string().trim().min(16).max(25),
    holder: text(60),
})

export const shopPatchBody = z.object({
    name: text(60).optional(),
    brandColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
    address: z.string().trim().max(200).nullable().optional(),
    location: locationSchema.nullable().optional(),
    delivery: z
        .object({
            fee: money,
            freeFrom: optionalMoney,
            minOrder: optionalMoney,
            radiusMeters: z.number().int().min(1).max(100_000).nullable().optional(),
        })
        .optional(),
    workingHours: z.partialRecord(z.enum(WEEKDAYS), timeRange).nullable().optional(),
    acceptingOrders: z.boolean().optional(),
    networkDelivery: z.boolean().optional(),
    features: z.array(z.enum(FEATURES)).max(10).optional(),
    bottleDeposit: z.number().int().min(0).max(1_000_000).optional(),
})

export const registerShopBody = z
    .object({
        /** A bot from BotFather: the owner pasted its token. */
        botToken: z
            .string()
            .regex(/^\d{5,15}:[A-Za-z0-9_-]{30,64}$/)
            .optional(),
        /** A bot the owner created from the Zumda bot (Managed Bots): we already hold its token. */
        managedBotId: z.number().int().positive().optional(),
        name: text(60),
        type: z.enum(BUSINESS_TYPES),
        address: z.string().trim().max(200).optional(),
        location: locationSchema.optional(),
        /** Set later in «Ishga tayyor»: zero until then. */
        deliveryFee: money.optional(),
        freeDeliveryFrom: money.optional(),
        minOrder: money.optional(),
        /** Customers pay only by transfer: no card, no orders. It may come later. */
        payoutCard: payoutCardBody.optional(),
    })
    .refine((body) => (body.botToken === undefined) !== (body.managedBotId === undefined), {
        message: "Send botToken or managedBotId, not both",
        path: ["botToken"],
    })

/**
 * The Telegram Login Widget's data: every field it sends goes into the signature, so unknown
 * fields are kept (as text or numbers), not dropped.
 */
export const loginBody = z.object({
    idToken: z
        .string()
        .max(8192)
        .regex(/^[\w-]+\.[\w-]+\.[\w-]+$/),
})

/** Step «Bot» of the application: the name suggested for the new bot. */
export const prepareManagedBotBody = z.object({ name: text(60) })

/** «Platforma»: which list of shops the admin opens. */
export const adminShopsQuery = z.object({ status: z.enum(BUSINESS_STATUSES) })

/** A rejection may say why: the owner reads it and fixes the application. */
export const reviewShopBody = z.object({
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(300).optional(),
})

/** A showcase deal: the commission on goods in percent (5 or 2.5), or `null` to end it. */
export const marketplaceBody = z.object({
    percent: z.number().min(0).max(99.99).multipleOf(0.01).nullable(),
})

/** A district: a new one needs a center and a radius; an existing one may change any of them. */
export const districtBody = z.object({
    name: z
        .string()
        .trim()
        .regex(/^[\p{L}\p{N}' -]{2,60}$/u),
    center: locationSchema.optional(),
    radiusKm: z.number().min(0.5).max(200).optional(),
    waitMinutes: z.number().int().min(1).max(240).optional(),
})

interface ValidationResult {
    success: boolean
    error?: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }
}

/** zValidator hook: our standard 400 error body. */
export function onInvalid(result: ValidationResult, c: Context): Response | undefined {
    if (result.success) {
        return undefined
    }
    return c.json(
        {
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid request",
                details: (result.error?.issues ?? []).map((issue) => ({
                    field: issue.path.map(String).join("."),
                    message: issue.message,
                })),
            },
        },
        400,
    )
}

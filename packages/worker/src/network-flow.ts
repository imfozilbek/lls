import { OrderStatus } from "@lls/core"

import { Notifier } from "./telegram/notifier.js"

import type { Services } from "./services.js"
import type { Business, NetworkClaim, NetworkRequest, OrderDTO } from "@lls/core"

/**
 * After the owner's step: an order the shop just accepted goes to the district network when no
 * courier of its own is free. Returns the order as it is now, and the request if one was made.
 */
export async function networkAfterStep(
    services: Services,
    order: OrderDTO,
): Promise<{ order: OrderDTO; request: NetworkRequest | null }> {
    if (order.status !== OrderStatus.ACCEPTED) {
        return { order, request: null }
    }
    const request = await services.useCases.autoRequestNetwork.execute({ orderId: order.id })
    return { order: request?.order ?? order, request }
}

/** The owner's step reaches everyone: cards, the customer, and the network if it was asked. */
export async function notifyOwnerStep(
    services: Services,
    business: Business,
    order: OrderDTO,
    request: NetworkRequest | null,
): Promise<void> {
    const notifier = new Notifier(services)
    await notifier.orderChanged(business, order)
    if (request) {
        await notifier.networkRequested(request)
    }
    await reportOverdueNetworkOrders(services)
}

/**
 * After «Деньги пришли — принять»: a new order was accepted in the same tap and reaches everyone
 * like any owner step. A transfer for a cancelled order only changes the cards (owed back).
 */
export async function notifyPaymentConfirmed(
    services: Services,
    business: Business,
    order: OrderDTO,
    request: NetworkRequest | null,
): Promise<void> {
    if (order.status === OrderStatus.ACCEPTED) {
        await notifyOwnerStep(services, business, order, request)
        return
    }
    await new Notifier(services).paymentChanged(business, order)
}

/** No cron: every network event also reports orders nobody took in time. */
export async function reportOverdueNetworkOrders(services: Services): Promise<void> {
    const late = await services.useCases.overdueNetworkOrders.execute()
    if (late.length > 0) {
        await new Notifier(services).networkOverdue(late)
    }
}

/** «Беру» won: cards, offers and the owner, then the overdue check. */
export async function notifyNetworkClaim(services: Services, claim: NetworkClaim): Promise<void> {
    await new Notifier(services).networkClaimed(claim)
    await reportOverdueNetworkOrders(services)
}

import type { Order } from "../../domain/entities/order.js"
import type { OrderStatus } from "../../domain/enums/order-status.js"
import type { Page, PageRequest } from "../dtos/pagination.js"

export interface OrderRepository {
    findById(id: string): Promise<Order | null>
    /** The next free order number in this shop (1, 2, 3 …). */
    nextNumber(businessId: string): Promise<number>
    /** Returns false if another order took the same number first. */
    insert(order: Order): Promise<boolean>
    save(order: Order): Promise<void>
    /** Newest first. */
    listByBusiness(
        businessId: string,
        statuses: readonly OrderStatus[] | undefined,
        page: PageRequest,
    ): Promise<Page<Order>>
    /** A courier's orders: every active one, plus the ones finished since `since`. Newest first. */
    listByCourier(courierId: string, since: Date): Promise<Order[]>
    /** Newest first. */
    listByCustomer(customerId: string, businessId: string, page: PageRequest): Promise<Page<Order>>
    /** Counts by creation time and money by delivery time, both in [from, to). */
    moneyTotals(businessId: string, from: Date, to: Date): Promise<MoneyTotals>
    /**
     * Money that needs the owner: transfers the customer says are sent but not confirmed yet,
     * and cancelled orders that were paid (owed back). Oldest first.
     */
    listOpenPayments(businessId: string, limit: number): Promise<Order[]>
    /** Orders created in [from, to), oldest first: the owner's export. */
    listCreatedBetween(businessId: string, from: Date, to: Date, limit: number): Promise<Order[]>
    /**
     * Saves a network courier's «Беру» only if nobody took the order in between (still no
     * courier, still asked of the network, still before pickup). False: someone was faster.
     */
    claimForNetwork(order: Order): Promise<boolean>
    /** Orders of shops in these districts waiting for a network courier, oldest first. */
    listWaitingForNetwork(districtIds: readonly string[], limit: number): Promise<Order[]>
    /** Delivered orders of a district in [from, to): all, and those a network courier took. */
    networkShare(districtId: string, from: Date, to: Date): Promise<NetworkShare>
}

export interface NetworkShare {
    delivered: number
    viaNetwork: number
}

/** Sums for a period, UZS. Money counts delivered orders by delivery time. */
export interface MoneyTotals {
    /** Orders placed in the period (any status but cancelled). */
    placed: number
    delivered: number
    cancelled: number
    goods: number
    delivery: number
    /** Bottle deposits: held for the customer, not revenue. */
    deposits: number
    /** Transfers that arrived for the delivered orders. */
    paid: number
    /** Zumda commission on showcase orders. */
    commission: number
}

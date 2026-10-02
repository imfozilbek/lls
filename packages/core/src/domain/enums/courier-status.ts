/**
 * A courier's work for one shop.
 * - `pending`: accepted the shop's invite; the owner has not approved yet.
 * - `active`: approved; gets this shop's orders on the days the owner set.
 * - `removed`: declined or removed by the owner. A new invite brings them back to `pending`.
 * - `network`: not the shop's courier; took one of its orders from the district network. The
 *   link carries those orders and the cash owed to the shop.
 */
export enum CourierStatus {
    PENDING = "pending",
    ACTIVE = "active",
    REMOVED = "removed",
    NETWORK = "network",
}

export const COURIER_STATUSES: readonly CourierStatus[] = Object.values(CourierStatus)

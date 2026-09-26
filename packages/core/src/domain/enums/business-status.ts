export enum BusinessStatus {
    PENDING = "pending",
    ACTIVE = "active",
    DISABLED = "disabled",
}

export const BUSINESS_STATUSES: readonly BusinessStatus[] = Object.values(BusinessStatus)

import type { Business } from "../../domain/entities/business.js"
import type { BusinessStatus } from "../../domain/enums/business-status.js"

export interface BusinessRepository {
    findById(id: string): Promise<Business | null>
    /** Several shops in one read (the order of the result is not kept). */
    findByIds(ids: readonly string[]): Promise<Business[]>
    findBySlug(slug: string): Promise<Business | null>
    findByBotId(botId: number): Promise<Business | null>
    listByOwner(ownerTelegramId: number): Promise<Business[]>
    /** Active shops with a marketplace deal: the Zumda showcase. */
    listInShowcase(): Promise<Business[]>
    /** The platform admin's lists: applications, live shops, turned-off ones. Newest first. */
    listByStatus(status: BusinessStatus, limit: number): Promise<Business[]>
    /** Every shop with a location: their districts are recomputed when a district changes. */
    listWithLocation(): Promise<Business[]>
    /** Insert a new shop together with its bot token. The adapter encrypts the token. */
    insert(business: Business, botToken: string): Promise<void>
    save(business: Business): Promise<void>
    /** Telegram issued the shop's bot a new token (a managed bot). The adapter encrypts it. */
    replaceBotToken(businessId: string, botToken: string): Promise<void>
    /** Whether the shop's bot can write to its owner: not an edit, so no version check. */
    saveOwnerChat(business: Business): Promise<void>
}

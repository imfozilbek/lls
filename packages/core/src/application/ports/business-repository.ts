import type { Business } from "../../domain/entities/business.js"

export interface BusinessRepository {
    findById(id: string): Promise<Business | null>
    findBySlug(slug: string): Promise<Business | null>
    findByBotId(botId: number): Promise<Business | null>
    listByOwner(ownerTelegramId: number): Promise<Business[]>
    /** Active shops with a marketplace deal: the Zumda showcase. */
    listInShowcase(): Promise<Business[]>
    /** Every shop with a location: their districts are recomputed when a district changes. */
    listWithLocation(): Promise<Business[]>
    /** Insert a new shop together with its bot token. The adapter encrypts the token. */
    insert(business: Business, botToken: string): Promise<void>
    save(business: Business): Promise<void>
    /** Telegram issued the shop's bot a new token (a managed bot). The adapter encrypts it. */
    replaceBotToken(businessId: string, botToken: string): Promise<void>
}

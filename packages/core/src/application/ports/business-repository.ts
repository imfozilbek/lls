import { Business } from "../../domain/entities/business.js"
import { BusinessType } from "../../domain/enums/business-type.js"

export interface BusinessRepository {
    findById(id: string): Promise<Business | null>
    findByTelegramId(telegramId: number): Promise<Business | null>
    findAll(): Promise<Business[]>
    findByType(type: BusinessType): Promise<Business[]>
    findActive(): Promise<Business[]>
    save(business: Business): Promise<void>
    delete(id: string): Promise<void>
}

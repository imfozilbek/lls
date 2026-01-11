import { Courier } from "../../domain/entities/courier.js"

export interface CourierRepository {
    findById(id: string): Promise<Courier | null>
    findByTelegramId(telegramId: number): Promise<Courier | null>
    findAvailable(): Promise<Courier[]>
    findActive(): Promise<Courier[]>
    save(courier: Courier): Promise<void>
    delete(id: string): Promise<void>
}

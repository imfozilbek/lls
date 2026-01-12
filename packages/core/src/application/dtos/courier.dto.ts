import type { Courier } from "../../domain/entities/courier.js"

export interface CourierDTO {
    id: string
    telegramId: number
    name: string
    phone: string
    isAvailable: boolean
    isActive: boolean
    createdAt: string
    updatedAt: string
}

export interface CreateCourierInput {
    telegramId: number
    name: string
    phone: string
}

export interface UpdateCourierInput {
    name?: string
    phone?: string
}

export function toCourierDTO(courier: Courier): CourierDTO {
    return {
        id: courier.id,
        telegramId: courier.telegramId.value,
        name: courier.name,
        phone: courier.phone.format(),
        isAvailable: courier.isAvailable,
        isActive: courier.isActive,
        createdAt: courier.createdAt.toISOString(),
        updatedAt: courier.updatedAt.toISOString(),
    }
}

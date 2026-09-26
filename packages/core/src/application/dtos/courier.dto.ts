import type { Courier } from "../../domain/entities/courier.js"

export interface CourierDTO {
    id: string
    name: string
    phone?: string
    isActive: boolean
    createdAt: string
}

export function toCourierDTO(courier: Courier): CourierDTO {
    return {
        id: courier.id,
        name: courier.name,
        phone: courier.phone?.number,
        isActive: courier.isActive,
        createdAt: courier.createdAt.toISOString(),
    }
}

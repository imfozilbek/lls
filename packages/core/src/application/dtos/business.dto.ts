import type { AddressDTO } from "./common.dto.js"
import type { Business } from "../../domain/entities/business.js"
import type { BusinessType } from "../../domain/enums/business-type.js"

export interface BusinessDTO {
    id: string
    name: string
    type: BusinessType
    address: AddressDTO
    telegramId: number
    isActive: boolean
    createdAt: string
    updatedAt: string
}

export interface CreateBusinessInput {
    name: string
    type: BusinessType
    address: AddressDTO
    telegramId: number
}

export interface UpdateBusinessInput {
    name?: string
    address?: AddressDTO
}

export interface BusinessFilter {
    type?: BusinessType
    isActive?: boolean
}

export function toBusinessDTO(business: Business): BusinessDTO {
    const address = business.address
    return {
        id: business.id,
        name: business.name,
        type: business.type,
        address: {
            street: address.street,
            city: address.city,
            latitude: address.coordinates?.latitude,
            longitude: address.coordinates?.longitude,
        },
        telegramId: business.telegramId.value,
        isActive: business.isActive,
        createdAt: business.createdAt.toISOString(),
        updatedAt: business.updatedAt.toISOString(),
    }
}

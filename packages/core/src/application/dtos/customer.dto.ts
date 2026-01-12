import type { AddressDTO } from "./common.dto.js"
import type { Customer } from "../../domain/entities/customer.js"


export interface CustomerDTO {
    id: string
    telegramId: number
    name: string
    phone: string
    address: AddressDTO
    createdAt: string
    updatedAt: string
}

export interface CreateCustomerInput {
    telegramId: number
    name: string
    phone: string
    address: AddressDTO
}

export interface UpdateCustomerInput {
    name?: string
    phone?: string
    address?: AddressDTO
}

export interface TelegramUserData {
    telegramId: number
    firstName: string
    lastName?: string
    username?: string
}

export function toCustomerDTO(customer: Customer): CustomerDTO {
    const address = customer.address
    return {
        id: customer.id,
        telegramId: customer.telegramId.value,
        name: customer.name,
        phone: customer.phone.format(),
        address: {
            street: address.street,
            city: address.city,
            latitude: address.coordinates?.latitude,
            longitude: address.coordinates?.longitude,
        },
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
    }
}

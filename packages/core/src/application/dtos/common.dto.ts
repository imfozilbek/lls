export interface AddressDTO {
    street: string
    city: string
    latitude?: number
    longitude?: number
}

export interface MoneyDTO {
    amount: number
    currency: string
}

export interface PaginationInput {
    page?: number
    limit?: number
}

export interface PaginatedResult<T> {
    items: T[]
    total: number
    page: number
    limit: number
    totalPages: number
}

export function createPaginatedResult<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
): PaginatedResult<T> {
    return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    }
}

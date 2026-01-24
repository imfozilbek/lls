import { Transform } from "class-transformer"
import { IsInt, IsOptional, Max, Min } from "class-validator"

export class PaginationDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    @Transform(({ value }) => parseInt(value as string, 10))
    page?: number = 1

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    @Transform(({ value }) => parseInt(value as string, 10))
    limit?: number = 20
}

export interface PaginatedResult<T> {
    data: T[]
    meta: {
        page: number
        limit: number
        total: number
        totalPages: number
        hasNext: boolean
        hasPrev: boolean
    }
}

export function paginate<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
): PaginatedResult<T> {
    const totalPages = Math.ceil(total / limit)

    return {
        data: items,
        meta: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        },
    }
}

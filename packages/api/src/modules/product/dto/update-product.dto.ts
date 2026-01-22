import { Type } from "class-transformer"
import {
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    IsUrl,
    MaxLength,
    MinLength,
    ValidateNested,
} from "class-validator"

class MoneyDto {
    @IsNumber()
    @IsPositive()
    amount!: number

    @IsString()
    currency!: string
}

export class UpdateProductDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name?: string

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string

    @IsOptional()
    @ValidateNested()
    @Type(() => MoneyDto)
    price?: MoneyDto

    @IsOptional()
    @IsString()
    @MaxLength(100)
    category?: string

    @IsOptional()
    @IsString()
    @IsUrl()
    imageUrl?: string
}

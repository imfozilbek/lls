import { Type } from "class-transformer"
import {
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    IsUrl,
    MaxLength,
    MinLength,
    ValidateNested,
} from "class-validator"

export class MoneyDto {
    @IsNumber()
    @IsPositive()
    amount!: number

    @IsString()
    @IsNotEmpty()
    currency!: string
}

export class CreateProductDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @MaxLength(200)
    name!: string

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string

    @ValidateNested()
    @Type(() => MoneyDto)
    price!: MoneyDto

    @IsOptional()
    @IsString()
    @MaxLength(100)
    category?: string

    @IsOptional()
    @IsString()
    @IsUrl()
    imageUrl?: string
}

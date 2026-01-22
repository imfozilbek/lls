import { Type } from "class-transformer"
import {
    ArrayMinSize,
    IsArray,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    ValidateNested,
} from "class-validator"

class MoneyDto {
    @IsNumber()
    @IsPositive()
    amount!: number

    @IsString()
    @IsNotEmpty()
    currency!: string
}

class AddressDto {
    @IsString()
    @IsNotEmpty()
    street!: string

    @IsString()
    @IsNotEmpty()
    city!: string

    @IsOptional()
    @IsNumber()
    latitude?: number

    @IsOptional()
    @IsNumber()
    longitude?: number
}

class CreateOrderItemDto {
    @IsString()
    @IsNotEmpty()
    productId!: string

    @IsString()
    @IsNotEmpty()
    productName!: string

    @IsNumber()
    @IsPositive()
    quantity!: number

    @ValidateNested()
    @Type(() => MoneyDto)
    unitPrice!: MoneyDto
}

export class CreateOrderDto {
    @IsString()
    @IsNotEmpty()
    customerId!: string

    @IsString()
    @IsNotEmpty()
    businessId!: string

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateOrderItemDto)
    items!: CreateOrderItemDto[]

    @ValidateNested()
    @Type(() => AddressDto)
    deliveryAddress!: AddressDto
}

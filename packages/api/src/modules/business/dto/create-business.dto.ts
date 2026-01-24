import { BusinessType } from "@lls/core"
import { Type } from "class-transformer"
import {
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    ValidateNested,
} from "class-validator"

export class AddressDto {
    @IsString()
    @IsNotEmpty({ message: "Street address is required" })
    @MaxLength(200)
    street!: string

    @IsString()
    @IsNotEmpty({ message: "City is required" })
    @MaxLength(100)
    city!: string

    @IsOptional()
    @IsNumber()
    latitude?: number

    @IsOptional()
    @IsNumber()
    longitude?: number
}

export class CreateBusinessDto {
    @IsString()
    @IsNotEmpty({ message: "Business name is required" })
    @MaxLength(100)
    name!: string

    @IsEnum(BusinessType, { message: "Type must be one of: food, construction, water" })
    type!: BusinessType

    @ValidateNested()
    @Type(() => AddressDto)
    address!: AddressDto

    @IsNumber()
    telegramId!: number
}

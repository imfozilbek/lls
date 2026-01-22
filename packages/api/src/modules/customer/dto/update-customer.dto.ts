import { Type } from "class-transformer"
import {
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
    ValidateNested,
} from "class-validator"

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

export class UpdateCustomerDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name?: string

    @IsOptional()
    @IsString()
    @Matches(/^\+?[0-9]{9,15}$/, {
        message: "Phone must be a valid phone number (9-15 digits, optional + prefix)",
    })
    phone?: string

    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    address?: AddressDto
}

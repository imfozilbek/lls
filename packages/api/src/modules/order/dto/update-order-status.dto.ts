import { OrderStatus } from "@lls/core"
import { IsEnum } from "class-validator"

export class UpdateOrderStatusDto {
    @IsEnum(OrderStatus)
    status!: OrderStatus
}

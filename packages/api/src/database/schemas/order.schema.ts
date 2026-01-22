import { OrderStatus } from "@lls/core"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import type { HydratedDocument } from "mongoose"

export type OrderDocument = HydratedDocument<Order>

@Schema({ _id: false })
export class OrderItem {
    @Prop({ required: true, type: String })
    id: string

    @Prop({ required: true, type: String })
    productId: string

    @Prop({ required: true, type: String })
    productName: string

    @Prop({ required: true, min: 1, type: Number })
    quantity: number

    @Prop({ required: true, type: Object })
    unitPrice: {
        amount: number
        currency: string
    }
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem)

@Schema({ timestamps: true, collection: "orders" })
export class Order {
    @Prop({ required: true, type: String })
    _id: string

    @Prop({ required: true, index: true, type: String })
    customerId: string

    @Prop({ required: true, index: true, type: String })
    businessId: string

    @Prop({ index: true, type: String })
    courierId?: string

    @Prop({ required: true, type: [OrderItemSchema] })
    items: OrderItem[]

    @Prop({ required: true, type: Object })
    deliveryAddress: {
        street: string
        city: string
        latitude?: number
        longitude?: number
    }

    @Prop({
        required: true,
        type: String,
        enum: Object.values(OrderStatus),
        default: OrderStatus.PENDING,
        index: true,
    })
    status: OrderStatus

    @Prop({ required: true, type: Object })
    total: {
        amount: number
        currency: string
    }

    createdAt: Date
    updatedAt: Date
}

export const OrderSchema = SchemaFactory.createForClass(Order)

OrderSchema.index({ businessId: 1, status: 1 })
OrderSchema.index({ courierId: 1, status: 1 })
OrderSchema.index({ status: 1, createdAt: -1 })

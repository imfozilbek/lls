import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import type { HydratedDocument } from "mongoose"

export type CustomerDocument = HydratedDocument<Customer>

@Schema({ timestamps: true, collection: "customers" })
export class Customer {
    @Prop({ required: true, type: String })
    _id: string

    @Prop({ required: true, unique: true, index: true })
    telegramId: number

    @Prop({ required: true })
    name: string

    @Prop({ required: true })
    phone: string

    @Prop({ required: true, type: Object })
    address: {
        street: string
        city: string
        latitude?: number
        longitude?: number
    }

    createdAt: Date
    updatedAt: Date
}

export const CustomerSchema = SchemaFactory.createForClass(Customer)

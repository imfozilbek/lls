import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import type { HydratedDocument } from "mongoose"

export type CourierDocument = HydratedDocument<Courier>

@Schema({ timestamps: true, collection: "couriers" })
export class Courier {
    @Prop({ required: true, type: String })
    _id: string

    @Prop({ required: true, unique: true, index: true, type: Number })
    telegramId: number

    @Prop({ required: true, type: String })
    name: string

    @Prop({ required: true, type: String })
    phone: string

    @Prop({ default: false, index: true, type: Boolean })
    isAvailable: boolean

    @Prop({ default: true, index: true, type: Boolean })
    isActive: boolean

    @Prop({ type: Object })
    currentLocation?: {
        latitude: number
        longitude: number
    }

    createdAt: Date
    updatedAt: Date
}

export const CourierSchema = SchemaFactory.createForClass(Courier)

CourierSchema.index({ isAvailable: 1, isActive: 1 })

import { BusinessType } from "@lls/core"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import type { HydratedDocument } from "mongoose"

export type BusinessDocument = HydratedDocument<Business>

@Schema({ timestamps: true, collection: "businesses" })
export class Business {
    @Prop({ required: true, type: String })
    _id: string

    @Prop({ required: true })
    name: string

    @Prop({ required: true, enum: Object.values(BusinessType) })
    type: BusinessType

    @Prop({ required: true, type: Object })
    address: {
        street: string
        city: string
        latitude?: number
        longitude?: number
    }

    @Prop({ required: true, unique: true, index: true })
    telegramId: number

    @Prop({ default: true, index: true })
    isActive: boolean

    createdAt: Date
    updatedAt: Date
}

export const BusinessSchema = SchemaFactory.createForClass(Business)

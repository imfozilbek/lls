import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import type { HydratedDocument } from "mongoose"

export type ProductDocument = HydratedDocument<Product>

@Schema({ timestamps: true, collection: "products" })
export class Product {
    @Prop({ required: true, type: String })
    _id: string

    @Prop({ required: true, index: true, type: String })
    businessId: string

    @Prop({ required: true, type: String })
    name: string

    @Prop({ type: String })
    description?: string

    @Prop({ required: true, type: Object })
    price: {
        amount: number
        currency: string
    }

    @Prop({ type: String })
    category?: string

    @Prop({ default: true, index: true, type: Boolean })
    isAvailable: boolean

    createdAt: Date
    updatedAt: Date
}

export const ProductSchema = SchemaFactory.createForClass(Product)

ProductSchema.index({ businessId: 1, isAvailable: 1 })

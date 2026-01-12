import { Money, Product as ProductEntity } from "@lls/core"
import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"

import { Product, ProductDocument } from "../../database/schemas/product.schema.js"

import type { ProductRepository } from "@lls/core"

@Injectable()
export class MongoDbProductRepository implements ProductRepository {
    constructor(
        @InjectModel(Product.name)
        private readonly model: Model<ProductDocument>,
    ) {}

    async findById(id: string): Promise<ProductEntity | null> {
        const doc = await this.model.findById(id).lean()
        return doc ? this.toDomain(doc) : null
    }

    async findByBusinessId(businessId: string): Promise<ProductEntity[]> {
        const docs = await this.model.find({ businessId }).sort({ createdAt: -1 }).lean()
        return docs.map((doc) => this.toDomain(doc))
    }

    async findAvailableByBusinessId(businessId: string): Promise<ProductEntity[]> {
        const docs = await this.model
            .find({ businessId, isAvailable: true })
            .sort({ category: 1, name: 1 })
            .lean()
        return docs.map((doc) => this.toDomain(doc))
    }

    async findByCategory(businessId: string, category: string): Promise<ProductEntity[]> {
        const docs = await this.model
            .find({ businessId, category, isAvailable: true })
            .sort({ name: 1 })
            .lean()
        return docs.map((doc) => this.toDomain(doc))
    }

    async save(product: ProductEntity): Promise<void> {
        const doc = this.toDocument(product)
        await this.model.findByIdAndUpdate(product.id, doc, { upsert: true })
    }

    async delete(id: string): Promise<void> {
        await this.model.findByIdAndDelete(id)
    }

    private toDomain(doc: Product & { _id: string }): ProductEntity {
        return ProductEntity.reconstitute({
            id: doc._id,
            businessId: doc.businessId,
            name: doc.name,
            description: doc.description || "",
            price: Money.create(doc.price.amount, doc.price.currency),
            category: doc.category || "",
            imageUrl: undefined,
            isAvailable: doc.isAvailable,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        })
    }

    private toDocument(
        entity: ProductEntity,
    ): Omit<Product, "createdAt" | "updatedAt"> & { createdAt: Date; updatedAt: Date } {
        return {
            _id: entity.id,
            businessId: entity.businessId,
            name: entity.name,
            description: entity.description,
            price: {
                amount: entity.price.amount,
                currency: entity.price.currency,
            },
            category: entity.category,
            isAvailable: entity.isAvailable,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        }
    }
}

import { Address, Business as BusinessEntity, BusinessType, TelegramId } from "@lls/core"
import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"

import { Business, BusinessDocument } from "../../database/schemas/business.schema.js"

import type { BusinessRepository } from "@lls/core"

@Injectable()
export class MongoDbBusinessRepository implements BusinessRepository {
    constructor(
        @InjectModel(Business.name)
        private readonly model: Model<BusinessDocument>,
    ) {}

    async findById(id: string): Promise<BusinessEntity | null> {
        const doc = await this.model.findById(id).lean()
        return doc ? this.toDomain(doc) : null
    }

    async findByTelegramId(telegramId: number): Promise<BusinessEntity | null> {
        const doc = await this.model.findOne({ telegramId }).lean()
        return doc ? this.toDomain(doc) : null
    }

    async findAll(): Promise<BusinessEntity[]> {
        const docs = await this.model.find().sort({ createdAt: -1 }).lean()
        return docs.map((doc) => this.toDomain(doc))
    }

    async findByType(type: BusinessType): Promise<BusinessEntity[]> {
        const docs = await this.model.find({ type }).sort({ createdAt: -1 }).lean()
        return docs.map((doc) => this.toDomain(doc))
    }

    async findActive(): Promise<BusinessEntity[]> {
        const docs = await this.model.find({ isActive: true }).sort({ createdAt: -1 }).lean()
        return docs.map((doc) => this.toDomain(doc))
    }

    async save(business: BusinessEntity): Promise<void> {
        const doc = this.toDocument(business)
        await this.model.findByIdAndUpdate(business.id, doc, { upsert: true })
    }

    async delete(id: string): Promise<void> {
        await this.model.findByIdAndDelete(id)
    }

    private toDomain(doc: Business & { _id: string }): BusinessEntity {
        const coordinates =
            doc.address.latitude !== undefined && doc.address.longitude !== undefined
                ? { latitude: doc.address.latitude, longitude: doc.address.longitude }
                : undefined

        return BusinessEntity.reconstitute({
            id: doc._id,
            name: doc.name,
            type: doc.type as BusinessType,
            address: Address.create(doc.address.street, doc.address.city, coordinates),
            telegramId: TelegramId.create(doc.telegramId),
            isActive: doc.isActive,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        })
    }

    private toDocument(
        entity: BusinessEntity,
    ): Omit<Business, "createdAt" | "updatedAt"> & { createdAt: Date; updatedAt: Date } {
        return {
            _id: entity.id,
            name: entity.name,
            type: entity.type,
            address: {
                street: entity.address.street,
                city: entity.address.city,
                latitude: entity.address.coordinates?.latitude,
                longitude: entity.address.coordinates?.longitude,
            },
            telegramId: entity.telegramId.value,
            isActive: entity.isActive,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        }
    }
}

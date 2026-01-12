import { Courier as CourierEntity, Phone, TelegramId } from "@lls/core"
import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"

import { Courier, CourierDocument } from "../../database/schemas/courier.schema.js"

import type { CourierRepository } from "@lls/core"

@Injectable()
export class MongoDbCourierRepository implements CourierRepository {
    constructor(
        @InjectModel(Courier.name)
        private readonly model: Model<CourierDocument>,
    ) {}

    async findById(id: string): Promise<CourierEntity | null> {
        const doc = await this.model.findById(id).lean()
        return doc ? this.toDomain(doc) : null
    }

    async findByTelegramId(telegramId: number): Promise<CourierEntity | null> {
        const doc = await this.model.findOne({ telegramId }).lean()
        return doc ? this.toDomain(doc) : null
    }

    async findAvailable(): Promise<CourierEntity[]> {
        const docs = await this.model
            .find({ isAvailable: true, isActive: true })
            .sort({ createdAt: -1 })
            .lean()
        return docs.map((doc) => this.toDomain(doc))
    }

    async findActive(): Promise<CourierEntity[]> {
        const docs = await this.model.find({ isActive: true }).sort({ createdAt: -1 }).lean()
        return docs.map((doc) => this.toDomain(doc))
    }

    async save(courier: CourierEntity): Promise<void> {
        const doc = this.toDocument(courier)
        await this.model.findByIdAndUpdate(courier.id, doc, { upsert: true })
    }

    async delete(id: string): Promise<void> {
        await this.model.findByIdAndDelete(id)
    }

    private toDomain(doc: Courier & { _id: string }): CourierEntity {
        return CourierEntity.reconstitute({
            id: doc._id,
            telegramId: TelegramId.create(doc.telegramId),
            name: doc.name,
            phone: Phone.create(doc.phone),
            isAvailable: doc.isAvailable,
            isActive: doc.isActive,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        })
    }

    private toDocument(
        entity: CourierEntity,
    ): Omit<Courier, "createdAt" | "updatedAt" | "currentLocation"> & {
        createdAt: Date
        updatedAt: Date
    } {
        return {
            _id: entity.id,
            telegramId: entity.telegramId.value,
            name: entity.name,
            phone: entity.phone.number,
            isAvailable: entity.isAvailable,
            isActive: entity.isActive,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        }
    }
}

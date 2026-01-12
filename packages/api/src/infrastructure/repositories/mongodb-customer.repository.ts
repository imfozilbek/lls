import { Address, Customer as CustomerEntity, Phone, TelegramId } from "@lls/core"
import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"

import { Customer, CustomerDocument } from "../../database/schemas/customer.schema.js"

import type { CustomerRepository } from "@lls/core"

@Injectable()
export class MongoDbCustomerRepository implements CustomerRepository {
    constructor(
        @InjectModel(Customer.name)
        private readonly model: Model<CustomerDocument>,
    ) {}

    async findById(id: string): Promise<CustomerEntity | null> {
        const doc = await this.model.findById(id).lean()
        return doc ? this.toDomain(doc) : null
    }

    async findByTelegramId(telegramId: number): Promise<CustomerEntity | null> {
        const doc = await this.model.findOne({ telegramId }).lean()
        return doc ? this.toDomain(doc) : null
    }

    async save(customer: CustomerEntity): Promise<void> {
        const doc = this.toDocument(customer)
        await this.model.findByIdAndUpdate(customer.id, doc, { upsert: true })
    }

    async delete(id: string): Promise<void> {
        await this.model.findByIdAndDelete(id)
    }

    private toDomain(doc: Customer & { _id: string }): CustomerEntity {
        const coordinates =
            doc.address.latitude !== undefined && doc.address.longitude !== undefined
                ? { latitude: doc.address.latitude, longitude: doc.address.longitude }
                : undefined

        return CustomerEntity.reconstitute({
            id: doc._id,
            telegramId: TelegramId.create(doc.telegramId),
            name: doc.name,
            phone: Phone.create(doc.phone),
            address: Address.create(doc.address.street, doc.address.city, coordinates),
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        })
    }

    private toDocument(
        entity: CustomerEntity,
    ): Omit<Customer, "createdAt" | "updatedAt"> & { createdAt: Date; updatedAt: Date } {
        return {
            _id: entity.id,
            telegramId: entity.telegramId.value,
            name: entity.name,
            phone: entity.phone.number,
            address: {
                street: entity.address.street,
                city: entity.address.city,
                latitude: entity.address.coordinates?.latitude,
                longitude: entity.address.coordinates?.longitude,
            },
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        }
    }
}

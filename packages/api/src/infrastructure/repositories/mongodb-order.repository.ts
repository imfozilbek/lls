import {
    Address,
    Money,
    Order as OrderEntity,
    OrderItem as OrderItemEntity,
    OrderStatus,
} from "@lls/core"
import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"

import {
    Order,
    OrderDocument,
    OrderItem as OrderItemSchema,
} from "../../database/schemas/order.schema.js"

import type { OrderRepository } from "@lls/core"

@Injectable()
export class MongoDbOrderRepository implements OrderRepository {
    constructor(
        @InjectModel(Order.name)
        private readonly model: Model<OrderDocument>,
    ) {}

    async findById(id: string): Promise<OrderEntity | null> {
        const doc = await this.model.findById(id).lean()
        return doc ? this.toDomain(doc) : null
    }

    async findByCustomerId(customerId: string): Promise<OrderEntity[]> {
        const docs = await this.model
            .find({ customerId })
            .sort({ createdAt: -1 })
            .lean()
        return docs.map((doc) => this.toDomain(doc))
    }

    async findByBusinessId(businessId: string): Promise<OrderEntity[]> {
        const docs = await this.model
            .find({ businessId })
            .sort({ createdAt: -1 })
            .lean()
        return docs.map((doc) => this.toDomain(doc))
    }

    async findByCourierId(courierId: string): Promise<OrderEntity[]> {
        const docs = await this.model
            .find({ courierId })
            .sort({ createdAt: -1 })
            .lean()
        return docs.map((doc) => this.toDomain(doc))
    }

    async findByStatus(status: OrderStatus): Promise<OrderEntity[]> {
        const docs = await this.model.find({ status }).sort({ createdAt: -1 }).lean()
        return docs.map((doc) => this.toDomain(doc))
    }

    async findPendingByBusinessId(businessId: string): Promise<OrderEntity[]> {
        const docs = await this.model
            .find({ businessId, status: OrderStatus.PENDING })
            .sort({ createdAt: 1 })
            .lean()
        return docs.map((doc) => this.toDomain(doc))
    }

    async findAvailableForCourier(): Promise<OrderEntity[]> {
        const docs = await this.model
            .find({
                status: OrderStatus.READY,
                courierId: { $exists: false },
            })
            .sort({ createdAt: 1 })
            .lean()
        return docs.map((doc) => this.toDomain(doc))
    }

    async save(order: OrderEntity): Promise<void> {
        const doc = this.toDocument(order)
        await this.model.findByIdAndUpdate(order.id, doc, { upsert: true })
    }

    async delete(id: string): Promise<void> {
        await this.model.findByIdAndDelete(id)
    }

    private toDomain(doc: Order & { _id: string }): OrderEntity {
        const items = doc.items.map((item) =>
            OrderItemEntity.create({
                id: item.id,
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: Money.create(item.unitPrice.amount, item.unitPrice.currency),
            }),
        )

        const coordinates =
            doc.deliveryAddress.latitude !== undefined &&
            doc.deliveryAddress.longitude !== undefined
                ? {
                      latitude: doc.deliveryAddress.latitude,
                      longitude: doc.deliveryAddress.longitude,
                  }
                : undefined

        return OrderEntity.reconstitute({
            id: doc._id,
            customerId: doc.customerId,
            businessId: doc.businessId,
            courierId: doc.courierId,
            items,
            deliveryAddress: Address.create(
                doc.deliveryAddress.street,
                doc.deliveryAddress.city,
                coordinates,
            ),
            status: doc.status as OrderStatus,
            total: Money.create(doc.total.amount, doc.total.currency),
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        })
    }

    private toDocument(
        entity: OrderEntity,
    ): Omit<Order, "createdAt" | "updatedAt"> & { createdAt: Date; updatedAt: Date } {
        const items: OrderItemSchema[] = entity.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: {
                amount: item.unitPrice.amount,
                currency: item.unitPrice.currency,
            },
        }))

        return {
            _id: entity.id,
            customerId: entity.customerId,
            businessId: entity.businessId,
            courierId: entity.courierId,
            items,
            deliveryAddress: {
                street: entity.deliveryAddress.street,
                city: entity.deliveryAddress.city,
                latitude: entity.deliveryAddress.coordinates?.latitude,
                longitude: entity.deliveryAddress.coordinates?.longitude,
            },
            status: entity.status,
            total: {
                amount: entity.total.amount,
                currency: entity.total.currency,
            },
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        }
    }
}

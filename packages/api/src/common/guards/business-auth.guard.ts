import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"

import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"
import { MongoDbOrderRepository } from "../../infrastructure/repositories/mongodb-order.repository.js"
import { MongoDbProductRepository } from "../../infrastructure/repositories/mongodb-product.repository.js"

import type { TelegramUser } from "./telegram-auth.guard.js"
import type { FastifyRequest } from "fastify"

export const BUSINESS_AUTH_MODE_KEY = "businessAuthMode"

export type BusinessAuthModeType = "business" | "product" | "order"

@Injectable()
export class BusinessAuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly businessRepository: MongoDbBusinessRepository,
        private readonly productRepository: MongoDbProductRepository,
        private readonly orderRepository: MongoDbOrderRepository,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<FastifyRequest>()
        const telegramUser = (request as unknown as { telegramUser?: TelegramUser }).telegramUser

        if (!telegramUser) {
            throw new UnauthorizedException("Telegram authentication required")
        }

        const mode =
            this.reflector.get<BusinessAuthModeType>(
                BUSINESS_AUTH_MODE_KEY,
                context.getHandler(),
            ) || "business"

        const params = request.params as Record<string, string>

        let businessId: string | undefined

        switch (mode) {
            case "business":
                businessId = await this.getBusinessIdFromParams(params, telegramUser.id)
                break
            case "product":
                businessId = await this.getBusinessIdFromProduct(params)
                break
            case "order":
                businessId = await this.getBusinessIdFromOrder(params)
                break
        }

        if (!businessId) {
            throw new ForbiddenException("Resource not found")
        }

        const business = await this.businessRepository.findById(businessId)
        if (!business) {
            throw new ForbiddenException("Business not found")
        }

        if (business.telegramId.value !== telegramUser.id) {
            throw new ForbiddenException("You do not have access to this business")
        }

        return true
    }

    private async getBusinessIdFromParams(
        params: Record<string, string>,
        _telegramUserId: number,
    ): Promise<string | undefined> {
        return params["businessId"] || params["id"]
    }

    private async getBusinessIdFromProduct(
        params: Record<string, string>,
    ): Promise<string | undefined> {
        const productId = params["id"]
        if (!productId) {
            return undefined
        }

        const product = await this.productRepository.findById(productId)
        return product?.businessId
    }

    private async getBusinessIdFromOrder(
        params: Record<string, string>,
    ): Promise<string | undefined> {
        const orderId = params["id"]
        if (!orderId) {
            return undefined
        }

        const order = await this.orderRepository.findById(orderId)
        return order?.businessId
    }
}

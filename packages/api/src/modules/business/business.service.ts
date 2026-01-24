import {
    CreateBusinessUseCase,
    GetBusinessByTelegramIdUseCase,
    GetBusinessUseCase,
    ListBusinessesUseCase,
    UpdateBusinessUseCase,
} from "@lls/core"
import { Injectable } from "@nestjs/common"

import { paginate, PaginatedResult, PaginationDto } from "../../common/dto/pagination.dto.js"
import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"

import type { BusinessDTO, CreateBusinessInput, UpdateBusinessInput } from "@lls/core"

@Injectable()
export class BusinessService {
    private readonly listBusinesses: ListBusinessesUseCase
    private readonly getBusiness: GetBusinessUseCase
    private readonly getBusinessByTelegramId: GetBusinessByTelegramIdUseCase
    private readonly createBusiness: CreateBusinessUseCase
    private readonly updateBusiness: UpdateBusinessUseCase

    constructor(private readonly repository: MongoDbBusinessRepository) {
        this.listBusinesses = new ListBusinessesUseCase(repository)
        this.getBusiness = new GetBusinessUseCase(repository)
        this.getBusinessByTelegramId = new GetBusinessByTelegramIdUseCase(repository)
        this.createBusiness = new CreateBusinessUseCase(repository)
        this.updateBusiness = new UpdateBusinessUseCase(repository)
    }

    async list(pagination?: PaginationDto): Promise<PaginatedResult<BusinessDTO>> {
        const page = pagination?.page ?? 1
        const limit = pagination?.limit ?? 20

        // Only return active businesses to customers
        const all = await this.listBusinesses.execute({ isActive: true })
        const total = all.length
        const start = (page - 1) * limit
        const items = all.slice(start, start + limit)

        return paginate(items, total, page, limit)
    }

    async getById(id: string): Promise<BusinessDTO> {
        return this.getBusiness.execute(id)
    }

    async create(input: CreateBusinessInput): Promise<BusinessDTO> {
        return this.createBusiness.execute(input)
    }

    async update(id: string, input: UpdateBusinessInput): Promise<BusinessDTO> {
        return this.updateBusiness.execute(id, input)
    }

    async getByTelegramId(telegramId: number): Promise<BusinessDTO> {
        return this.getBusinessByTelegramId.execute(telegramId)
    }
}

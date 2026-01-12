import {
    CreateBusinessUseCase,
    GetBusinessUseCase,
    ListBusinessesUseCase,
    UpdateBusinessUseCase,
} from "@lls/core"
import { Injectable } from "@nestjs/common"

import { MongoDbBusinessRepository } from "../../infrastructure/repositories/mongodb-business.repository.js"

import type { BusinessDTO, CreateBusinessInput, UpdateBusinessInput } from "@lls/core"

@Injectable()
export class BusinessService {
    private readonly listBusinesses: ListBusinessesUseCase
    private readonly getBusiness: GetBusinessUseCase
    private readonly createBusiness: CreateBusinessUseCase
    private readonly updateBusiness: UpdateBusinessUseCase

    constructor(private readonly repository: MongoDbBusinessRepository) {
        this.listBusinesses = new ListBusinessesUseCase(repository)
        this.getBusiness = new GetBusinessUseCase(repository)
        this.createBusiness = new CreateBusinessUseCase(repository)
        this.updateBusiness = new UpdateBusinessUseCase(repository)
    }

    async list(): Promise<BusinessDTO[]> {
        return this.listBusinesses.execute()
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
}

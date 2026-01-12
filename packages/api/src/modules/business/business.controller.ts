import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common"

import { BusinessService } from "./business.service.js"

import type { BusinessDTO, CreateBusinessInput, UpdateBusinessInput } from "@lls/core"

@Controller("businesses")
export class BusinessController {
    constructor(private readonly service: BusinessService) {}

    @Get()
    async list(): Promise<BusinessDTO[]> {
        return this.service.list()
    }

    @Get(":id")
    async getById(@Param("id") id: string): Promise<BusinessDTO> {
        return this.service.getById(id)
    }

    @Post()
    async create(@Body() input: CreateBusinessInput): Promise<BusinessDTO> {
        return this.service.create(input)
    }

    @Patch(":id")
    async update(
        @Param("id") id: string,
        @Body() input: UpdateBusinessInput,
    ): Promise<BusinessDTO> {
        return this.service.update(id, input)
    }
}

import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common"

import { TelegramAuthService } from "../../common/services/telegram-auth.service.js"

import { BusinessService } from "./business.service.js"
import { TelegramLoginDto } from "./dto/telegram-login.dto.js"

import type { BusinessDTO, CreateBusinessInput, UpdateBusinessInput } from "@lls/core"

@Controller("businesses")
export class BusinessController {
    constructor(
        private readonly service: BusinessService,
        private readonly telegramAuthService: TelegramAuthService,
    ) {}

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

    @Get("telegram/:telegramId")
    async getByTelegramId(@Param("telegramId") telegramId: string): Promise<BusinessDTO> {
        return this.service.getByTelegramId(Number(telegramId))
    }

    @Post("auth/telegram")
    async authenticateWithTelegram(@Body() data: TelegramLoginDto): Promise<BusinessDTO> {
        this.telegramAuthService.validateTelegramLogin(data)
        return this.service.getByTelegramId(data.id)
    }
}

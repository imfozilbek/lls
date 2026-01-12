import { createParamDecorator, ExecutionContext } from "@nestjs/common"

import type { TelegramUser } from "../guards/telegram-auth.guard.js"
import type { FastifyRequest } from "fastify"

export const TelegramUserDecorator = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): TelegramUser => {
        const request = ctx.switchToHttp().getRequest<FastifyRequest>()
        return (request as unknown as { telegramUser: TelegramUser }).telegramUser
    },
)

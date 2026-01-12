import {
    BusinessRuleViolationError,
    DomainError,
    EntityNotFoundError,
    InvalidOrderTransitionError,
    ValidationError,
} from "@lls/core"
import { ArgumentsHost, Catch, HttpStatus } from "@nestjs/common"
import { BaseExceptionFilter } from "@nestjs/core"

import type { FastifyReply } from "fastify"

@Catch(DomainError)
export class DomainExceptionFilter extends BaseExceptionFilter {
    catch(exception: DomainError, host: ArgumentsHost): void {
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<FastifyReply>()

        const status = this.getHttpStatus(exception)
        const body = {
            statusCode: status,
            error: exception.code,
            message: exception.message,
            details: exception.details,
            timestamp: new Date().toISOString(),
        }

        response.status(status).send(body)
    }

    private getHttpStatus(exception: DomainError): number {
        if (exception instanceof ValidationError) {
            return HttpStatus.BAD_REQUEST
        }
        if (exception instanceof EntityNotFoundError) {
            return HttpStatus.NOT_FOUND
        }
        if (exception instanceof BusinessRuleViolationError) {
            return HttpStatus.UNPROCESSABLE_ENTITY
        }
        if (exception instanceof InvalidOrderTransitionError) {
            return HttpStatus.UNPROCESSABLE_ENTITY
        }
        return HttpStatus.INTERNAL_SERVER_ERROR
    }
}

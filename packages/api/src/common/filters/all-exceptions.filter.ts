import { ArgumentsHost, Catch, HttpException, HttpStatus } from "@nestjs/common"
import { BaseExceptionFilter } from "@nestjs/core"

import type { FastifyReply } from "fastify"

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<FastifyReply>()

        let status = HttpStatus.INTERNAL_SERVER_ERROR
        let message = "Internal server error"
        let error = "INTERNAL_ERROR"

        if (exception instanceof HttpException) {
            status = exception.getStatus()
            const exceptionResponse = exception.getResponse()
            if (typeof exceptionResponse === "string") {
                message = exceptionResponse
            } else if (typeof exceptionResponse === "object") {
                const resp = exceptionResponse as Record<string, unknown>
                message = (resp["message"] as string) || message
                error = (resp["error"] as string) || error
            }
        } else if (exception instanceof Error) {
            message = exception.message
            console.error("Unhandled exception:", exception.stack)
        }

        const body = {
            statusCode: status,
            error,
            message,
            timestamp: new Date().toISOString(),
        }

        response.status(status).send(body)
    }
}

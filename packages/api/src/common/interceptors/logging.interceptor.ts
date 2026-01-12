import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common"
import { Observable, tap } from "rxjs"

import type { FastifyRequest } from "fastify"

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest<FastifyRequest>()
        const { method, url } = request
        const startTime = Date.now()

        return next.handle().pipe(
            tap(() => {
                const duration = Date.now() - startTime
                const message = `${method} ${url} - ${duration}ms`
                process.stdout.write(`[API] ${message}\n`)
            }),
        )
    }
}

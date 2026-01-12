import { Controller, Get } from "@nestjs/common"

interface HealthResponse {
    status: string
    timestamp: string
}

@Controller()
export class AppController {
    @Get("health")
    health(): HealthResponse {
        return {
            status: "ok",
            timestamp: new Date().toISOString(),
        }
    }

    @Get("ready")
    ready(): HealthResponse {
        return {
            status: "ready",
            timestamp: new Date().toISOString(),
        }
    }
}

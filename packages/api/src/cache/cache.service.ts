import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common"
import { Redis } from "ioredis"

import { CacheTTL, REDIS_CLIENT } from "./cache.constants.js"

@Injectable()
export class CacheService implements OnModuleDestroy {
    constructor(
        @Inject(REDIS_CLIENT)
        private readonly redis: Redis,
    ) {}

    async get<T>(key: string): Promise<T | null> {
        const value = await this.redis.get(key)
        if (!value) {
            return null
        }
        return JSON.parse(value) as T
    }

    async set<T>(key: string, value: T, ttl: number = CacheTTL.MEDIUM): Promise<void> {
        await this.redis.setex(key, ttl, JSON.stringify(value))
    }

    async setex<T>(key: string, ttl: number, value: T): Promise<void> {
        await this.redis.setex(key, ttl, JSON.stringify(value))
    }

    async del(key: string): Promise<void> {
        await this.redis.del(key)
    }

    async delByPattern(pattern: string): Promise<void> {
        const keys = await this.redis.keys(pattern)
        if (keys.length > 0) {
            await this.redis.del(...keys)
        }
    }

    async exists(key: string): Promise<boolean> {
        const result = await this.redis.exists(key)
        return result === 1
    }

    async ttl(key: string): Promise<number> {
        return this.redis.ttl(key)
    }

    async incr(key: string): Promise<number> {
        return this.redis.incr(key)
    }

    async expire(key: string, seconds: number): Promise<void> {
        await this.redis.expire(key, seconds)
    }

    onModuleDestroy(): void {
        this.redis.disconnect()
    }
}

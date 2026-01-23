import type { DomainEvent } from "./domain-event.js"

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => void | Promise<void>

/**
 * Simple in-memory event dispatcher for domain events
 */
export class EventDispatcher {
    private handlers: Map<string, EventHandler[]> = new Map()
    private static instance: EventDispatcher | null = null

    static getInstance(): EventDispatcher {
        if (!EventDispatcher.instance) {
            EventDispatcher.instance = new EventDispatcher()
        }
        return EventDispatcher.instance
    }

    static resetInstance(): void {
        EventDispatcher.instance = null
    }

    subscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
        const handlers = this.handlers.get(eventName) ?? []
        handlers.push(handler as EventHandler)
        this.handlers.set(eventName, handlers)
    }

    unsubscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
        const handlers = this.handlers.get(eventName)
        if (handlers) {
            const index = handlers.indexOf(handler as EventHandler)
            if (index > -1) {
                handlers.splice(index, 1)
            }
        }
    }

    async dispatch(event: DomainEvent): Promise<void> {
        const handlers = this.handlers.get(event.eventName) ?? []
        const allHandlers = [...handlers, ...(this.handlers.get("*") ?? [])]

        for (const handler of allHandlers) {
            await handler(event)
        }
    }

    dispatchSync(event: DomainEvent): void {
        const handlers = this.handlers.get(event.eventName) ?? []
        const allHandlers = [...handlers, ...(this.handlers.get("*") ?? [])]

        for (const handler of allHandlers) {
            void handler(event)
        }
    }

    clear(): void {
        this.handlers.clear()
    }

    getHandlerCount(eventName: string): number {
        return this.handlers.get(eventName)?.length ?? 0
    }
}

/**
 * Base class for all domain events
 */
export abstract class DomainEvent {
    public readonly occurredOn: Date
    public readonly eventId: string

    constructor() {
        this.occurredOn = new Date()
        this.eventId = this.generateEventId()
    }

    private generateEventId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    }

    abstract get eventName(): string
}

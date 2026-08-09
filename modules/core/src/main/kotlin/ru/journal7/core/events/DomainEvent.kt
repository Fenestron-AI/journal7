package ru.journal7.core.events

import java.time.Instant
import java.util.UUID

interface DomainEvent {
    val eventId: UUID
    val occurredAt: Instant
}

abstract class BaseDomainEvent : DomainEvent {
    override val eventId: UUID = UUID.randomUUID()
    override val occurredAt: Instant = Instant.now()
}

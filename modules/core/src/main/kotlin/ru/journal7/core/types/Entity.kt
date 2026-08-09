package ru.journal7.core.types

import java.time.Instant
import java.util.UUID

abstract class Entity<T : Any> {
    abstract val id: T

    open val createdAt: Instant = Instant.now()
    open var updatedAt: Instant = Instant.now()
}

abstract class UuidEntity : Entity<UUID>() {
    override val id: UUID = UUID.randomUUID()
}

abstract class SoftDeletableEntity<T : Any> : Entity<T>() {
    open val deleted: Boolean = false
    open val deletedAt: Instant? = null
}

data class Page<T>(
    val items: List<T>,
    val total: Long,
    val page: Int,
    val size: Int
) {
    val totalPages: Int get() = if (size == 0) 0 else ((total + size - 1) / size).toInt()
    val hasNext: Boolean get() = page < totalPages
    val hasPrev: Boolean get() = page > 1
}

data class PageRequest(
    val page: Int = 1,
    val size: Int = 20
) {
    val offset: Long get() = ((page - 1) * size).toLong()
}

package ru.journal7.auth.domain

import ru.journal7.core.types.UuidEntity
import java.util.UUID

data class User(
    override val id: UUID = UUID.randomUUID(),
    val username: String,
    val passwordHash: String,
    val fullName: String,
    val email: String? = null,
    val role: UserRole = UserRole.VIEWER,
    val deleted: Boolean = false,
) : UuidEntity() {
    override val createdAt = java.time.Instant.now()
    override var updatedAt = java.time.Instant.now()
}

enum class UserRole(val permissions: Set<String>) {
    ADMIN(setOf("*")),
    CALCULATOR(setOf("calculation:read", "calculation:write", "reference:read")),
    CONTRACTOR(setOf("contract:read", "contract:write", "reference:read")),
    ANALYST(setOf("report:read", "calculation:read", "reference:read")),
    VIEWER(setOf("reference:read", "report:read"));

    fun hasPermission(permission: String): Boolean =
        permissions.contains("*") || permissions.contains(permission)
}

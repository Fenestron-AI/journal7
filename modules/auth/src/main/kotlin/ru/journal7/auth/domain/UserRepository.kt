package ru.journal7.auth.domain

import ru.journal7.core.types.DomainError
import java.util.UUID

interface UserRepository {
    suspend fun findByUsername(username: String): User?
    suspend fun findById(id: UUID): User?
    suspend fun create(user: User): User
    suspend fun update(user: User): User
    suspend fun softDelete(id: UUID): Boolean
    suspend fun list(page: Int = 1, size: Int = 20): List<User>
    suspend fun count(): Long
}

data class UserNotFound(override val message: String = "User not found") : DomainError.NotFound(message)
data class UserAlreadyExists(override val message: String = "User already exists") : DomainError.Conflict(message)
data class InvalidCredentials(override val message: String = "Invalid credentials") : DomainError.Unauthorized(message)

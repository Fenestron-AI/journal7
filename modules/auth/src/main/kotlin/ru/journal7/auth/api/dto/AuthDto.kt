package ru.journal7.auth.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val username: String,
    val password: String
)

@Serializable
data class RefreshRequest(
    val refreshToken: String
)

@Serializable
data class AuthResponse(
    val accessToken: String,
    val refreshToken: String,
    val tokenType: String = "Bearer",
    val expiresIn: Long
)

@Serializable
data class UserResponse(
    val id: String,
    val username: String,
    val fullName: String,
    val email: String?,
    val role: String
)

@Serializable
data class CreateUserRequest(
    val username: String,
    val password: String,
    val fullName: String,
    val email: String? = null,
    val role: String = "VIEWER"
)

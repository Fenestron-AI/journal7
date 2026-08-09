package ru.journal7.auth.domain

data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
    val tokenType: String = "Bearer",
    val expiresIn: Long
)

data class TokenClaims(
    val userId: String,
    val username: String,
    val role: String,
    val permissions: Set<String>
)

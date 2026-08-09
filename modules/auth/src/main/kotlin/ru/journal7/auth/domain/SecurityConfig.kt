package ru.journal7.auth.domain

data class SecurityConfig(
    val jwtSecret: String,
    val jwtIssuer: String = "journal7.ru",
    val accessTokenTtlMinutes: Long = 60,
    val refreshTokenTtlDays: Long = 30
)

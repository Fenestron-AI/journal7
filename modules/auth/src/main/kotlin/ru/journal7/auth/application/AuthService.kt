package ru.journal7.auth.application

import at.favre.lib.crypto.bcrypt.BCrypt
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.auth0.jwt.exceptions.JWTVerificationException
import ru.journal7.auth.domain.*
import java.util.*

class AuthService(
    private val userRepository: UserRepository,
    private val securityConfig: SecurityConfig
) {
    private val algorithm = Algorithm.HMAC256(securityConfig.jwtSecret)
    private val verifier = JWT.require(algorithm)
        .withIssuer(securityConfig.jwtIssuer)
        .build()

    suspend fun login(username: String, password: String): AuthTokens {
        val user = userRepository.findByUsername(username)
            ?: throw InvalidCredentials()

        if (user.deleted) throw InvalidCredentials("User is deactivated")

        val result = BCrypt.verifyer().verify(password.toCharArray(), user.passwordHash)
        if (!result.verified) throw InvalidCredentials()

        return generateTokens(user)
    }

    suspend fun refresh(refreshToken: String): AuthTokens {
        val claims = verifyToken(refreshToken)
        val user = userRepository.findById(java.util.UUID.fromString(claims.userId))
            ?: throw InvalidCredentials("User not found")

        if (user.deleted) throw InvalidCredentials("User is deactivated")

        return generateTokens(user)
    }

    suspend fun me(userId: java.util.UUID): User {
        return userRepository.findById(userId)
            ?: throw UserNotFound()
    }

    suspend fun createUser(
        username: String,
        password: String,
        fullName: String,
        email: String? = null,
        role: UserRole = UserRole.VIEWER
    ): User {
        val existing = userRepository.findByUsername(username)
        if (existing != null) throw UserAlreadyExists()

        val passwordHash = BCrypt.withDefaults().hashToString(12, password.toCharArray())

        val user = User(
            username = username,
            passwordHash = passwordHash,
            fullName = fullName,
            email = email,
            role = role
        )

        return userRepository.create(user)
    }

    fun verifyToken(token: String): TokenClaims {
        return try {
            val decoded = verifier.verify(token)
            TokenClaims(
                userId = decoded.getClaim("userId").asString(),
                username = decoded.subject,
                role = decoded.getClaim("role").asString(),
                permissions = decoded.getClaim("permissions").asList(String::class.java).toSet()
            )
        } catch (e: JWTVerificationException) {
            throw InvalidCredentials("Invalid token: ${e.message}")
        }
    }

    private fun generateTokens(user: User): AuthTokens {
        val now = Date()
        val accessExpiration = Date(now.time + securityConfig.accessTokenTtlMinutes * 60 * 1000)
        val refreshExpiration = Date(now.time + securityConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000)

        val accessToken = JWT.create()
            .withIssuer(securityConfig.jwtIssuer)
            .withSubject(user.username)
            .withClaim("userId", user.id.toString())
            .withClaim("role", user.role.name)
            .withClaim("permissions", user.role.permissions.toList())
            .withIssuedAt(now)
            .withExpiresAt(accessExpiration)
            .withJWTId(java.util.UUID.randomUUID().toString())
            .sign(algorithm)

        val refreshToken = JWT.create()
            .withIssuer(securityConfig.jwtIssuer)
            .withSubject(user.username)
            .withClaim("userId", user.id.toString())
            .withClaim("type", "refresh")
            .withIssuedAt(now)
            .withExpiresAt(refreshExpiration)
            .withJWTId(java.util.UUID.randomUUID().toString())
            .sign(algorithm)

        return AuthTokens(
            accessToken = accessToken,
            refreshToken = refreshToken,
            expiresIn = securityConfig.accessTokenTtlMinutes * 60
        )
    }
}

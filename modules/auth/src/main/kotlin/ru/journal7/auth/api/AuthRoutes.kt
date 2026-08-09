package ru.journal7.auth.api

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.koin.ktor.ext.inject
import ru.journal7.auth.api.dto.*
import ru.journal7.auth.application.AuthService
import ru.journal7.auth.domain.InvalidCredentials
import ru.journal7.auth.domain.SecurityConfig
import java.util.UUID

fun Application.configureAuthPlugin() {
    val securityConfig by inject<SecurityConfig>()
    val algorithm = Algorithm.HMAC256(securityConfig.jwtSecret)

    install(Authentication) {
        jwt("auth-jwt") {
            verifier(JWT.require(algorithm).withIssuer(securityConfig.jwtIssuer).build())
            validate { credential ->
                if (credential.payload.getClaim("type").asString() == "refresh") {
                    return@validate null
                }
                JWTPrincipal(credential.payload)
            }
        }
    }
}

fun Route.authRoutes() {
    val authService by inject<AuthService>()

    route("/api/v1/auth") {
        post("login") {
            val request = call.receive<LoginRequest>()
            val tokens = authService.login(request.username, request.password)
            call.respond(
                AuthResponse(
                    accessToken = tokens.accessToken,
                    refreshToken = tokens.refreshToken,
                    tokenType = tokens.tokenType,
                    expiresIn = tokens.expiresIn
                )
            )
        }

        post("refresh") {
            val request = call.receive<RefreshRequest>()
            val tokens = authService.refresh(request.refreshToken)
            call.respond(
                AuthResponse(
                    accessToken = tokens.accessToken,
                    refreshToken = tokens.refreshToken,
                    tokenType = tokens.tokenType,
                    expiresIn = tokens.expiresIn
                )
            )
        }

        authenticate("auth-jwt") {
            get("me") {
                val userId = call.principal<JWTPrincipal>()
                    ?.payload
                    ?.getClaim("userId")
                    ?.asString()
                    ?: throw InvalidCredentials()

                val user = authService.me(UUID.fromString(userId))
                call.respond(
                    UserResponse(
                        id = user.id.toString(),
                        username = user.username,
                        fullName = user.fullName,
                        email = user.email,
                        role = user.role.name
                    )
                )
            }
        }
    }
}

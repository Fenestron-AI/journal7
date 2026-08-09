package ru.journal7

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.koin.dsl.module
import org.koin.ktor.plugin.Koin
import ru.journal7.auth.api.authRoutes
import ru.journal7.auth.api.configureAuthPlugin
import ru.journal7.auth.application.AuthService
import ru.journal7.auth.domain.SecurityConfig
import ru.journal7.auth.domain.UserRepository
import ru.journal7.auth.infrastructure.PostgresUserRepository
import ru.journal7.plugins.*

fun main() {
    val config = loadConfig()

    DatabaseFactory.init(config.db)

    embeddedServer(Netty, host = config.server.host, port = config.server.port) {
        configureKoin(config)
        configureSerialization()
        configureErrorHandling()
        configureCors(config.cors)
        configureMonitoring()
        configureRouting()
        configureAuthPlugin()

        routing {
            get("/api/health") {
                call.respondText(
                    """{"status":"ok","version":"0.1.0"}""",
                    ContentType.Application.Json
                )
            }
            authRoutes()
        }
    }.start(wait = true)
}

private fun Application.configureKoin(config: AppConfig) {
    val appModule = module {
        single { config }
        single { config.db }
        single { config.redis }
        single { config.minio }

        single {
            SecurityConfig(
                jwtSecret = config.jwt.secret,
                jwtIssuer = config.jwt.issuer,
                accessTokenTtlMinutes = config.jwt.accessTtlMinutes,
                refreshTokenTtlDays = config.jwt.refreshTtlDays
            )
        }

        single<UserRepository> { PostgresUserRepository() }
        single { AuthService(get(), get()) }
    }

    install(Koin) {
        modules(appModule)
    }
}

package ru.journal7.plugins

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.cors.routing.*
import ru.journal7.CorsConfig

fun Application.configureCors(config: CorsConfig) {
    install(CORS) {
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Patch)
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.ContentType)
        allowHeader("X-Requested-With")
        allowCredentials = true
        config.allowedOrigins.forEach { origin ->
            val cleanOrigin = origin.replace("http://", "").replace("https://", "")
            allowHost(cleanOrigin, schemes = listOf("http", "https"))
        }
    }
}

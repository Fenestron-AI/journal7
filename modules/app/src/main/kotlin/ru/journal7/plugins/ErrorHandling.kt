package ru.journal7.plugins

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import kotlinx.serialization.Serializable
import ru.journal7.core.types.DomainError

fun Application.configureErrorHandling() {
    install(StatusPages) {
        exception<DomainError.NotFound> { call, cause ->
            call.respond(HttpStatusCode.NotFound, ErrorResponse(cause.code, cause.message))
        }
        exception<DomainError.Validation> { call, cause ->
            call.respond(HttpStatusCode.UnprocessableEntity, ErrorResponse(cause.code, cause.message))
        }
        exception<DomainError.Conflict> { call, cause ->
            call.respond(HttpStatusCode.Conflict, ErrorResponse(cause.code, cause.message))
        }
        exception<DomainError.Forbidden> { call, cause ->
            call.respond(HttpStatusCode.Forbidden, ErrorResponse(cause.code, cause.message))
        }
        exception<DomainError.Unauthorized> { call, cause ->
            call.respond(HttpStatusCode.Unauthorized, ErrorResponse(cause.code, cause.message))
        }
        exception<DomainError.ClosedPeriod> { call, cause ->
            call.respond(HttpStatusCode.Conflict, ErrorResponse(cause.code, cause.message))
        }
        exception<DomainError.Internal> { call, cause ->
            call.respond(HttpStatusCode.InternalServerError, ErrorResponse(cause.code, cause.message))
        }
        exception<Throwable> { call, cause ->
            call.application.environment.log.error("Unhandled error", cause)
            call.respond(HttpStatusCode.InternalServerError, ErrorResponse("INTERNAL_ERROR", "Internal server error"))
        }
    }
}

@Serializable
data class ErrorResponse(
    val code: String,
    val message: String,
    val details: Map<String, String>? = null
)

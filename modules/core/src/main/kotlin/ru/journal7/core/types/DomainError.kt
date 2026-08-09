package ru.journal7.core.types

sealed class DomainError(
    override val message: String,
    open val code: String = "DOMAIN_ERROR"
) : RuntimeException(message) {

    open class NotFound(message: String) : DomainError(message, "NOT_FOUND")
    open class Validation(message: String, val field: String? = null) : DomainError(message, "VALIDATION_ERROR")
    open class Conflict(message: String) : DomainError(message, "CONFLICT")
    open class Forbidden(message: String) : DomainError(message, "FORBIDDEN")
    open class Unauthorized(message: String) : DomainError(message, "UNAUTHORIZED")
    open class Internal(message: String, val originalError: Throwable? = null) : DomainError(message, "INTERNAL_ERROR")
    class Calculation(message: String, val details: Map<String, Any>? = null) : DomainError(message, "CALCULATION_ERROR")
    class ClosedPeriod(message: String) : DomainError(message, "CLOSED_PERIOD")
}

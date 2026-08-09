package ru.journal7.core.types

sealed interface Result<out T, out E> {
    data class Ok<T>(val value: T) : Result<T, Nothing>
    data class Err<E>(val error: E) : Result<Nothing, E>

    val isOk get() = this is Ok<*>
    val isErr get() = this is Err<*>

    fun <U> map(transform: (T) -> U): Result<U, E> = when (this) {
        is Ok -> Ok(transform(value))
        is Err -> this
    }

    @Suppress("UNCHECKED_CAST")
    fun <U> flatMap(transform: (T) -> Result<U, @UnsafeVariance E>): Result<U, E> = when (this) {
        is Ok -> transform(value)
        is Err -> this as Result<U, E>
    }

    fun getOrNull(): T? = when (this) {
        is Ok -> value
        is Err -> null
    }

    fun getOrElse(default: (@UnsafeVariance E) -> @UnsafeVariance T): T = when (this) {
        is Ok -> value
        is Err -> default(error)
    }
}

fun <T> T.asOk(): Result<T, Nothing> = Result.Ok(this)
fun <E> E.asErr(): Result<Nothing, E> = Result.Err(this)

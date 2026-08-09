package ru.journal7.reference.domain

import ru.journal7.core.types.DomainError
import ru.journal7.core.types.Page
import ru.journal7.core.types.PageRequest
import java.util.UUID

interface CounterpartyRepository {
    suspend fun findById(id: UUID): Counterparty?
    suspend fun findByCode(code: String): Counterparty?
    suspend fun search(query: String, type: CounterpartyType?, page: PageRequest): Page<Counterparty>
    suspend fun create(counterparty: Counterparty): Counterparty
    suspend fun update(counterparty: Counterparty): Counterparty
    suspend fun softDelete(id: UUID): Boolean
}

class CounterpartyNotFound(message: String = "Counterparty not found") : DomainError.NotFound(message)
class CounterpartyCodeExists(message: String = "Counterparty code already exists") : DomainError.Conflict(message)

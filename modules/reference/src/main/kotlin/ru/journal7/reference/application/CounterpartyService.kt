package ru.journal7.reference.application

import ru.journal7.core.types.Page
import ru.journal7.core.types.PageRequest
import ru.journal7.reference.domain.*
import java.util.UUID

class CounterpartyService(
    private val counterpartyRepository: CounterpartyRepository
) {
    suspend fun getById(id: UUID): Counterparty {
        return counterpartyRepository.findById(id) ?: throw CounterpartyNotFound()
    }

    suspend fun search(query: String, type: String?, page: Int, size: Int): Page<Counterparty> {
        val counterpartyType = type?.let { CounterpartyType.valueOf(it.uppercase()) }
        return counterpartyRepository.search(query, counterpartyType, PageRequest(page, size))
    }

    suspend fun create(request: Counterparty): Counterparty {
        val existing = counterpartyRepository.findByCode(request.code)
        if (existing != null) throw CounterpartyCodeExists()

        return counterpartyRepository.create(request)
    }

    suspend fun update(id: UUID, request: Counterparty): Counterparty {
        val existing = counterpartyRepository.findById(id) ?: throw CounterpartyNotFound()

        val existingCode = counterpartyRepository.findByCode(request.code)
        if (existingCode != null && existingCode.id != id) {
            throw CounterpartyCodeExists()
        }

        return counterpartyRepository.update(request.copy(id = id))
    }

    suspend fun delete(id: UUID) {
        val existing = counterpartyRepository.findById(id) ?: throw CounterpartyNotFound()
        counterpartyRepository.softDelete(id)
    }
}

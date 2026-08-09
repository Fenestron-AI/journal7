package ru.journal7.billing.domain

import ru.journal7.core.types.DomainError
import java.util.UUID

interface InvoiceRepository {
    suspend fun findById(id: UUID): Invoice?
    suspend fun findByContract(contractId: UUID): List<Invoice>
    suspend fun findByNumber(number: String): Invoice?
    suspend fun create(invoice: Invoice): Invoice
    suspend fun update(invoice: Invoice): Invoice
    suspend fun delete(id: UUID): Boolean
}

interface AcceptanceActRepository {
    suspend fun findById(id: UUID): AcceptanceAct?
    suspend fun findByContract(contractId: UUID): List<AcceptanceAct>
    suspend fun create(act: AcceptanceAct): AcceptanceAct
    suspend fun update(act: AcceptanceAct): AcceptanceAct
    suspend fun delete(id: UUID): Boolean
}

class InvoiceNotFound(message: String = "Invoice not found") : DomainError.NotFound(message)
class ActNotFound(message: String = "Act not found") : DomainError.NotFound(message)
class InvoiceNumberExists(message: String = "Invoice number already exists") : DomainError.Conflict(message)

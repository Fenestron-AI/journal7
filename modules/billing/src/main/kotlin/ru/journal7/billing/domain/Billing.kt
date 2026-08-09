package ru.journal7.billing.domain

import kotlinx.serialization.Serializable
import ru.journal7.core.types.UuidEntity
import java.time.LocalDate
import java.util.UUID

data class Invoice(
    override val id: UUID = UUID.randomUUID(),
    val contractId: UUID,
    val calculationId: UUID? = null,
    val number: String,
    val date: LocalDate,
    val type: InvoiceType = InvoiceType.REALIZATION,
    val items: List<InvoiceItem> = emptyList(),
    val totalAmount: Double = 0.0,
    val totalVat: Double = 0.0,
    val totalWithVat: Double = 0.0,
    val status: InvoiceStatus = InvoiceStatus.DRAFT,
    val createdBy: UUID? = null,
) : UuidEntity()

enum class InvoiceType { REALIZATION, ADVANCE_1, ADVANCE_2 }
enum class InvoiceStatus { DRAFT, ISSUED, PAID, CANCELLED }

@Serializable
data class InvoiceItem(
    val name: String,
    val unit: String = "МВт⋅ч",
    val quantity: Double,
    val price: Double,
    val amount: Double,
    val vatRate: Double = 20.0,
    val vatAmount: Double
)

data class AcceptanceAct(
    override val id: UUID = UUID.randomUUID(),
    val contractId: UUID,
    val calculationId: UUID? = null,
    val number: String,
    val date: LocalDate,
    val periodFrom: LocalDate,
    val periodTo: LocalDate,
    val volume: Double = 0.0,
    val cost: Double = 0.0,
    val status: ActStatus = ActStatus.DRAFT,
    val createdBy: UUID? = null,
) : UuidEntity()

enum class ActStatus { DRAFT, SIGNED, CANCELLED }

package ru.journal7.reference.domain

import ru.journal7.core.types.UuidEntity
import java.util.UUID

data class Counterparty(
    override val id: UUID = UUID.randomUUID(),
    val code: String,
    val name: String,
    val fullName: String? = null,
    val inn: String? = null,
    val kpp: String? = null,
    val ogrn: String? = null,
    val legalAddress: String? = null,
    val postalAddress: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val bankName: String? = null,
    val bankBik: String? = null,
    val bankKs: String? = null,
    val bankRs: String? = null,
    val type: CounterpartyType = CounterpartyType.SALE,
    val deleted: Boolean = false,
) : UuidEntity()

enum class CounterpartyType {
    SALE, PURCHASE, BOTH
}

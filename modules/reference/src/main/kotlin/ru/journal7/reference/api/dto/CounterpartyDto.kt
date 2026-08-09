package ru.journal7.reference.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class CounterpartyRequest(
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
    val type: String = "SALE"
)

@Serializable
data class CounterpartyResponse(
    val id: String,
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
    val type: String
)

@Serializable
data class CounterpartyListResponse(
    val items: List<CounterpartyResponse>,
    val total: Long,
    val page: Int,
    val size: Int,
    val totalPages: Int
)

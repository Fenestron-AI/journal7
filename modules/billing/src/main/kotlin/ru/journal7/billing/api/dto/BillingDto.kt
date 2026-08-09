package ru.journal7.billing.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class InvoiceRequest(
    val contractId: String,
    val calculationId: String? = null,
    val number: String,
    val date: String,
    val type: String = "REALIZATION",
    val items: List<InvoiceItemDto> = emptyList(),
    val totalAmount: Double = 0.0,
    val totalVat: Double = 0.0,
    val totalWithVat: Double = 0.0,
    val status: String = "DRAFT"
)

@Serializable
data class InvoiceResponse(
    val id: String,
    val contractId: String,
    val calculationId: String? = null,
    val number: String,
    val date: String,
    val type: String,
    val items: List<InvoiceItemDto>,
    val totalAmount: Double,
    val totalVat: Double,
    val totalWithVat: Double,
    val status: String
)

@Serializable
data class InvoiceItemDto(
    val name: String,
    val unit: String = "МВт⋅ч",
    val quantity: Double,
    val price: Double,
    val amount: Double,
    val vatRate: Double = 20.0,
    val vatAmount: Double
)

@Serializable
data class ActRequest(
    val contractId: String,
    val calculationId: String? = null,
    val number: String,
    val date: String,
    val periodFrom: String,
    val periodTo: String,
    val volume: Double = 0.0,
    val cost: Double = 0.0,
    val status: String = "DRAFT"
)

@Serializable
data class ActResponse(
    val id: String,
    val contractId: String,
    val calculationId: String? = null,
    val number: String,
    val date: String,
    val periodFrom: String,
    val periodTo: String,
    val volume: Double,
    val cost: Double,
    val status: String
)

@Serializable
data class GenerateInvoiceRequest(
    val calculationId: String,
    val number: String,
    val type: String = "REALIZATION"
)

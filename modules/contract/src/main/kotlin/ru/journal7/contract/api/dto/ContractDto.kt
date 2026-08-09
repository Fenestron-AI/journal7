package ru.journal7.contract.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class SaleContractRequest(
    val number: String,
    val counterpartyId: String,
    val dateFrom: String,
    val dateTo: String? = null,
    val type: String = "ENERGY_SALE",
    val priceCategory: String = "CK1",
    val calculationGroupId: String? = null,
    val metadata: Map<String, String> = emptyMap()
)

@Serializable
data class SaleContractResponse(
    val id: String,
    val number: String,
    val counterpartyId: String,
    val counterpartyName: String,
    val dateFrom: String,
    val dateTo: String? = null,
    val type: String,
    val priceCategory: String,
    val calculationGroupId: String? = null,
    val confirmed: Boolean,
    val confirmedBy: String? = null,
    val metadata: Map<String, String> = emptyMap()
)

@Serializable
data class SaleContractListResponse(
    val items: List<SaleContractResponse>,
    val total: Long,
    val page: Int,
    val size: Int
)

@Serializable
data class ObjectRequest(
    val name: String,
    val code: String? = null
)

@Serializable
data class ObjectResponse(
    val id: String,
    val contractId: String,
    val name: String,
    val code: String? = null
)

@Serializable
data class DeliveryPointRequest(
    val name: String,
    val code: String? = null,
    val meteringPoints: List<MeteringPointDto> = emptyList()
)

@Serializable
data class DeliveryPointResponse(
    val id: String,
    val objectId: String,
    val contractId: String,
    val name: String,
    val code: String? = null,
    val meteringPoints: List<MeteringPointDto> = emptyList()
)

@Serializable
data class MeteringPointDto(
    val id: String,
    val name: String,
    val code: String? = null,
    val voltageLevel: String? = null,
    val devices: List<MeterDeviceDto> = emptyList()
)

@Serializable
data class MeterDeviceDto(
    val id: String,
    val model: String? = null,
    val serialNumber: String? = null,
    val type: String = "ACTIVE",
    val coefficient: Double = 1.0,
    val installDate: String? = null,
    val verificationDate: String? = null
)

@Serializable
data class ContractTreeResponse(
    val contract: SaleContractResponse,
    val objects: List<ObjectNodeResponse>
)

@Serializable
data class ObjectNodeResponse(
    val object_: ObjectResponse,
    val deliveryPoints: List<DeliveryPointNodeResponse>
)

@Serializable
data class DeliveryPointNodeResponse(
    val deliveryPoint: DeliveryPointResponse,
    val meteringPoints: List<MeteringPointDto>
)

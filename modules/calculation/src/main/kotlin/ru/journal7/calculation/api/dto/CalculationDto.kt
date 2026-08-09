package ru.journal7.calculation.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class RunCalculationRequest(
    val profileId: String,
    val tariffRates: TariffRatesDto = TariffRatesDto(),
    val salesMarkup: Double = 0.0,
    val omCoefficient: Double = 0.0,
    val infrastructurePayment: Double = 0.0,
    val peakHours: List<Int>? = null,
    val halfPeakHours: List<Int>? = null
)

@Serializable
data class TariffRatesDto(
    val singleRate: Double = 0.0,
    val peakRate: Double = 0.0,
    val halfPeakRate: Double = 0.0,
    val offPeakRate: Double = 0.0,
    val hourlyRates: Map<String, Map<String, Double>> = emptyMap()
)

@Serializable
data class CalculationResultResponse(
    val id: String,
    val contractId: String,
    val priceCategory: String,
    val status: String,
    val periodFrom: String,
    val periodTo: String,
    val totalVolume: Double,
    val totalCost: Double,
    val costPerMwh: Double,
    val hourlyResults: List<HourlyResultDto>,
    val zoneResults: Map<String, ZoneResultDto>
)

@Serializable
data class HourlyResultDto(
    val date: String,
    val hour: Int,
    val volume: Double,
    val price: Double,
    val cost: Double,
    val zone: String? = null
)

@Serializable
data class ZoneResultDto(
    val zone: String,
    val volume: Double,
    val rate: Double,
    val cost: Double
)

@Serializable
data class CalculationListResponse(
    val items: List<CalculationResultResponse>,
    val total: Int
)

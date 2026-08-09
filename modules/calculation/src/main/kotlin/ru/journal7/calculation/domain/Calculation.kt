package ru.journal7.calculation.domain

import kotlinx.serialization.Serializable
import ru.journal7.core.types.LocalDateSerializer
import java.time.LocalDate
import java.util.UUID

sealed interface CalculationStrategy {
    val priceCategory: PriceCategory

    fun calculate(input: CalculationInput): CalculationResult
}

enum class PriceCategory {
    CK1, CK3, CK4, FCK
}

data class CalculationInput(
    val contractId: UUID,
    val regionId: UUID,
    val priceCategory: PriceCategory,
    val periodFrom: LocalDate,
    val periodTo: LocalDate,
    val powerValues: List<HourlyValue>,
    val tariffRates: TariffRates,
    val salesMarkup: Double = 0.0,
    val omCoefficient: Double = 0.0,
    val infrastructurePayment: Double = 0.0,
    val peakHours: Set<Int> = PEAK_HOURS_DEFAULT,
    val halfPeakHours: Set<Int> = HALF_PEAK_HOURS_DEFAULT
)

data class HourlyValue(
    val date: LocalDate,
    val hour: Int,
    val value: Double
)

data class TariffRates(
    val singleRate: Double = 0.0,
    val peakRate: Double = 0.0,
    val halfPeakRate: Double = 0.0,
    val offPeakRate: Double = 0.0,
    val hourlyRates: Map<LocalDate, Map<Int, Double>> = emptyMap()
)

data class CalculationResult(
    val id: UUID = UUID.randomUUID(),
    val contractId: UUID,
    val priceCategory: PriceCategory,
    val status: CalculationStatus = CalculationStatus.DRAFT,
    val periodFrom: LocalDate,
    val periodTo: LocalDate,
    val totalVolume: Double = 0.0,
    val totalCost: Double = 0.0,
    val hourlyResults: List<HourlyResult> = emptyList(),
    val zoneResults: Map<String, ZoneResult> = emptyMap()
) {
    val costPerMwh: Double get() = if (totalVolume > 0) totalCost / totalVolume else 0.0
}

@Serializable
data class HourlyResult(
    @Serializable(with = LocalDateSerializer::class) val date: LocalDate,
    val hour: Int,
    val volume: Double,
    val price: Double,
    val cost: Double,
    val zone: String? = null
)

@Serializable
data class ZoneResult(
    val zone: String,
    val volume: Double,
    val rate: Double,
    val cost: Double
)

enum class CalculationStatus { DRAFT, COMPLETED, FAILED, APPROVED }

val PEAK_HOURS_DEFAULT = setOf(8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20)
val HALF_PEAK_HOURS_DEFAULT = setOf(7, 21, 22, 23)
// Rest (0-6) are off-peak

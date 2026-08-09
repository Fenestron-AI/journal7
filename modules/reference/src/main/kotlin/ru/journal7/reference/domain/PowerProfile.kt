package ru.journal7.reference.domain

import ru.journal7.core.types.UuidEntity
import java.time.LocalDate
import java.util.UUID

data class PowerProfile(
    override val id: UUID = UUID.randomUUID(),
    val code: String,
    val name: String,
    val type: PowerProfileType = PowerProfileType.CONSUMPTION,
    val regionId: UUID? = null,
    val unit: String = "MW",
    val minValue: Double? = null,
    val maxValue: Double? = null,
    val avgValue: Double? = null,
    val valueCount: Int = 0,
) : UuidEntity()

enum class PowerProfileType {
    CONSUMPTION, LOSS, GENERATION
}

data class PowerProfileValue(
    val profileId: UUID,
    val periodDate: LocalDate,
    val hour: Int,
    val value: Double
)

data class PowerProfileHeatmapItem(
    val date: LocalDate,
    val hour: Int,
    val value: Double
)

data class PowerProfileHourlyStats(
    val hour: Int,
    val avg: Double,
    val min: Double,
    val max: Double,
    val stddev: Double
)

data class PowerProfileValidationResult(
    val profileId: UUID,
    val totalValues: Int,
    val missingHours: List<LocalDate>,
    val anomalies: List<Anomaly>,
    val gaps: List<Gap>,
    val isValid: Boolean
) {
    data class Anomaly(
        val date: LocalDate,
        val hour: Int,
        val value: Double,
        val reason: String
    )

    data class Gap(
        val from: LocalDate,
        val to: LocalDate,
        val missingHours: Int
    )
}

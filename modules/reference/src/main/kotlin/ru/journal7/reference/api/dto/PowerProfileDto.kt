package ru.journal7.reference.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class PowerProfileRequest(
    val code: String,
    val name: String,
    val type: String = "CONSUMPTION",
    val regionId: String? = null,
    val unit: String = "MW"
)

@Serializable
data class PowerProfileResponse(
    val id: String,
    val code: String,
    val name: String,
    val type: String,
    val regionId: String? = null,
    val unit: String,
    val minValue: Double? = null,
    val maxValue: Double? = null,
    val avgValue: Double? = null,
    val valueCount: Int
)

@Serializable
data class PowerProfileListResponse(
    val items: List<PowerProfileResponse>,
    val total: Long,
    val page: Int,
    val size: Int
)

@Serializable
data class PowerProfileValueItem(
    val date: String,
    val hour: Int,
    val value: Double
)

@Serializable
data class PowerProfileHeatmapResponse(
    val profileId: String,
    val from: String,
    val to: String,
    val data: List<PowerProfileValueItem>
)

@Serializable
data class PowerProfileHourlyStatsResponse(
    val hour: Int,
    val avg: Double,
    val min: Double,
    val max: Double,
    val stddev: Double
)

@Serializable
data class PowerProfileValidationResponse(
    val profileId: String,
    val totalValues: Int,
    val missingHours: List<String>,
    val anomalies: List<AnomalyItem>,
    val gaps: List<GapItem>,
    val isValid: Boolean
) {
    @Serializable
    data class AnomalyItem(
        val date: String,
        val hour: Int,
        val value: Double,
        val reason: String
    )

    @Serializable
    data class GapItem(
        val from: String,
        val to: String,
        val missingHours: Int
    )
}

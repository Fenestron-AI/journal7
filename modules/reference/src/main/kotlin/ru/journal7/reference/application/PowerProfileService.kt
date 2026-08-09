package ru.journal7.reference.application

import ru.journal7.reference.domain.*
import java.time.LocalDate
import java.util.UUID

class PowerProfileService(
    private val powerProfileRepository: PowerProfileRepository
) {
    suspend fun getById(id: UUID): PowerProfile {
        return powerProfileRepository.findById(id) ?: throw PowerProfileNotFound()
    }

    suspend fun search(query: String, type: String?, page: Int, size: Int): Pair<List<PowerProfile>, Long> {
        val profileType = type?.let { PowerProfileType.valueOf(it.uppercase()) }
        val items = powerProfileRepository.search(query, profileType, page, size)
        val total = powerProfileRepository.count(query, profileType)
        return items to total
    }

    suspend fun create(profile: PowerProfile): PowerProfile {
        val existing = powerProfileRepository.findByCode(profile.code)
        if (existing != null) throw PowerProfileCodeExists()
        return powerProfileRepository.create(profile)
    }

    suspend fun update(id: UUID, profile: PowerProfile): PowerProfile {
        powerProfileRepository.findById(id) ?: throw PowerProfileNotFound()
        return powerProfileRepository.update(profile.copy(id = id))
    }

    suspend fun delete(id: UUID) {
        powerProfileRepository.findById(id) ?: throw PowerProfileNotFound()
        powerProfileRepository.delete(id)
    }

    suspend fun getValues(profileId: UUID, from: LocalDate, to: LocalDate): List<PowerProfileValue> {
        powerProfileRepository.findById(profileId) ?: throw PowerProfileNotFound()
        return powerProfileRepository.getValues(profileId, from, to)
    }

    suspend fun upsertValues(profileId: UUID, values: List<PowerProfileValue>): Int {
        powerProfileRepository.findById(profileId) ?: throw PowerProfileNotFound()
        validateValues(values)
        return powerProfileRepository.upsertValues(profileId, values)
    }

    suspend fun getHourlyStats(profileId: UUID, from: LocalDate, to: LocalDate): List<PowerProfileHourlyStats> {
        powerProfileRepository.findById(profileId) ?: throw PowerProfileNotFound()
        return powerProfileRepository.getHourlyStats(profileId, from, to)
    }

    suspend fun getHeatmapData(profileId: UUID, from: LocalDate, to: LocalDate): List<PowerProfileHeatmapItem> {
        powerProfileRepository.findById(profileId) ?: throw PowerProfileNotFound()
        return powerProfileRepository.getValues(profileId, from, to).map { value ->
            PowerProfileHeatmapItem(
                date = value.periodDate,
                hour = value.hour,
                value = value.value
            )
        }
    }

    suspend fun validate(profileId: UUID, from: LocalDate, to: LocalDate): PowerProfileValidationResult {
        val profile = powerProfileRepository.findById(profileId) ?: throw PowerProfileNotFound()
        val values = powerProfileRepository.getValues(profileId, from, to)

        val valueMap = values.associateBy { "${it.periodDate}_${it.hour}" }

        val missingHours = mutableListOf<LocalDate>()
        val anomalies = mutableListOf<PowerProfileValidationResult.Anomaly>()
        val gaps = mutableListOf<PowerProfileValidationResult.Gap>()

        var currentDate = from
        var gapStart: LocalDate? = null

        while (!currentDate.isAfter(to)) {
            val hasData = (0..23).any { hour ->
                val key = "${currentDate}_${hour}"
                val value = valueMap[key]
                if (value != null) {
                    if (!value.value.isNaN() && !value.value.isInfinite()) {
                        if (profile.minValue != null && value.value < profile.minValue) {
                            anomalies.add(
                                PowerProfileValidationResult.Anomaly(
                                    date = currentDate,
                                    hour = hour,
                                    value = value.value,
                                    reason = "Value below minimum (${profile.minValue})"
                                )
                            )
                        }
                        if (profile.maxValue != null && value.value > profile.maxValue) {
                            anomalies.add(
                                PowerProfileValidationResult.Anomaly(
                                    date = currentDate,
                                    hour = hour,
                                    value = value.value,
                                    reason = "Value above maximum (${profile.maxValue})"
                                )
                            )
                        }
                    } else {
                        anomalies.add(
                            PowerProfileValidationResult.Anomaly(
                                date = currentDate,
                                hour = hour,
                                value = value.value,
                                reason = "Invalid value (NaN or Infinity)"
                            )
                        )
                    }
                }
                value != null
            }

            if (!hasData) {
                missingHours.add(currentDate)
                if (gapStart == null) gapStart = currentDate
            } else {
                if (gapStart != null) {
                    gaps.add(
                        PowerProfileValidationResult.Gap(
                            from = gapStart,
                            to = currentDate.minusDays(1),
                            missingHours = gapStart.datesUntil(currentDate).count().toInt() * 24
                        )
                    )
                    gapStart = null
                }
            }
            currentDate = currentDate.plusDays(1)
        }

        if (gapStart != null) {
            gaps.add(
                PowerProfileValidationResult.Gap(
                    from = gapStart,
                    to = to,
                    missingHours = gapStart.datesUntil(to.plusDays(1)).count().toInt() * 24
                )
            )
        }

        return PowerProfileValidationResult(
            profileId = profileId,
            totalValues = values.size,
            missingHours = missingHours,
            anomalies = anomalies,
            gaps = gaps,
            isValid = anomalies.isEmpty() && gaps.isEmpty()
        )
    }

    private fun validateValues(values: List<PowerProfileValue>) {
        values.forEach { v ->
            require(v.hour in 0..23) { "Invalid hour: ${v.hour}" }
            require(!v.value.isNaN() && !v.value.isInfinite()) { "Invalid value at ${v.periodDate}T${v.hour}: ${v.value}" }
        }
    }
}

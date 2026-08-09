package ru.journal7.reference.domain

import ru.journal7.core.types.DomainError
import java.time.LocalDate
import java.util.UUID

interface PowerProfileRepository {
    suspend fun findById(id: UUID): PowerProfile?
    suspend fun findByCode(code: String): PowerProfile?
    suspend fun search(query: String, type: PowerProfileType?, page: Int, size: Int): List<PowerProfile>
    suspend fun count(query: String, type: PowerProfileType?): Long
    suspend fun create(profile: PowerProfile): PowerProfile
    suspend fun update(profile: PowerProfile): PowerProfile
    suspend fun delete(id: UUID): Boolean

    suspend fun getValues(profileId: UUID, from: LocalDate, to: LocalDate): List<PowerProfileValue>
    suspend fun upsertValues(profileId: UUID, values: List<PowerProfileValue>): Int
    suspend fun deleteValues(profileId: UUID, from: LocalDate, to: LocalDate): Int

    suspend fun getHourlyStats(profileId: UUID, from: LocalDate, to: LocalDate): List<PowerProfileHourlyStats>
}

class PowerProfileNotFound(message: String = "Power profile not found") : DomainError.NotFound(message)
class PowerProfileCodeExists(message: String = "Power profile code already exists") : DomainError.Conflict(message)

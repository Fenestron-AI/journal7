package ru.journal7.calculation.domain

import java.util.UUID

interface CalculationRepository {
    suspend fun findById(id: UUID): CalculationResult?
    suspend fun findByContract(contractId: UUID): List<CalculationResult>
    suspend fun save(result: CalculationResult): CalculationResult
    suspend fun delete(id: UUID): Boolean
}

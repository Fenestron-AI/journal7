package ru.journal7.integration.domain

import java.time.LocalDate
import java.util.UUID

data class ImportResult(
    val totalRows: Int,
    val imported: Int,
    val skipped: Int,
    val errors: List<ImportError> = emptyList()
)

data class ImportError(
    val row: Int,
    val field: String,
    val message: String
)

data class ExportRequest(
    val contractId: UUID? = null,
    val periodFrom: LocalDate,
    val periodTo: LocalDate
)

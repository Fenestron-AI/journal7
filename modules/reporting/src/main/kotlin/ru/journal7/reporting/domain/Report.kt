package ru.journal7.reporting.domain

import java.util.UUID

data class ReportRequest(
    val type: ReportType,
    val contractId: UUID? = null,
    val calculationId: UUID? = null,
    val periodFrom: java.time.LocalDate,
    val periodTo: java.time.LocalDate,
    val format: ReportFormat = ReportFormat.XLSX
)

enum class ReportType { STANDARD_1, STANDARD_2, STANDARD_3, BILL, AGENT, PREMIUM, DYNAMIC }
enum class ReportFormat { XLSX, PDF }

data class ReportResult(
    val id: UUID = UUID.randomUUID(),
    val fileName: String,
    val contentType: String,
    val data: ByteArray,
    val size: Long = data.size.toLong()
)

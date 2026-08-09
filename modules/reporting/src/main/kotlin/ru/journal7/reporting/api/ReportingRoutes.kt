package ru.journal7.reporting.api

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.koin.ktor.ext.inject
import ru.journal7.billing.domain.InvoiceRepository
import ru.journal7.billing.domain.InvoiceNotFound
import ru.journal7.calculation.domain.CalculationRepository
import ru.journal7.reporting.application.ExcelReportService
import java.util.UUID

fun Route.reportingRoutes() {
    val excelService by inject<ExcelReportService>()
    val invoiceRepository by inject<InvoiceRepository>()
    val calculationRepository by inject<CalculationRepository>()

    route("/api/v1/reports") {
        get("bill/{invoiceId}") {
            val invoiceId = UUID.fromString(call.parameters["invoiceId"])
            val invoice = invoiceRepository.findById(invoiceId) ?: throw InvoiceNotFound()
            val report = excelService.generateBillReport(invoice)
            call.respondBytes(report.data, ContentType.parse(report.contentType))
        }

        get("calculation/{calculationId}") {
            val calcId = UUID.fromString(call.parameters["calculationId"])
            val calculation = calculationRepository.findById(calcId)
                ?: throw IllegalArgumentException("Calculation not found")
            val report = excelService.generateCalculationReport(calculation)
            call.respondBytes(report.data, ContentType.parse(report.contentType))
        }
    }
}

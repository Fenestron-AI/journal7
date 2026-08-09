package ru.journal7.billing.api

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.koin.ktor.ext.inject
import ru.journal7.billing.api.dto.*
import ru.journal7.billing.application.BillingService
import ru.journal7.billing.domain.*
import java.time.LocalDate
import java.util.UUID

fun Route.billingRoutes() {
    val service by inject<BillingService>()

    route("/api/v1/billing") {
        // --- Invoices ---
        post("invoices") {
            val req = call.receive<InvoiceRequest>()
            val invoice = service.createInvoice(req.toDomain())
            call.respond(HttpStatusCode.Created, invoice.toResponse())
        }

        get("invoices") {
            val contractId = call.request.queryParameters["contractId"] ?: throw IllegalArgumentException("contractId required")
            val invoices = service.getInvoicesByContract(UUID.fromString(contractId))
            call.respond(invoices.map { it.toResponse() })
        }

        get("invoices/{id}") {
            val id = UUID.fromString(call.parameters["id"])
            call.respond(service.getInvoice(id).toResponse())
        }

        put("invoices/{id}") {
            val id = UUID.fromString(call.parameters["id"])
            val req = call.receive<InvoiceRequest>()
            call.respond(service.updateInvoice(id, req.toDomain()).toResponse())
        }

        delete("invoices/{id}") {
            service.deleteInvoice(UUID.fromString(call.parameters["id"]))
            call.respond(HttpStatusCode.NoContent)
        }

        post("invoices/generate") {
            val req = call.receive<GenerateInvoiceRequest>()
            val contractId = call.request.queryParameters["contractId"] ?: throw IllegalArgumentException("contractId required")
            val invoice = service.generateInvoiceFromCalculation(
                contractId = UUID.fromString(contractId),
                calculationId = UUID.fromString(req.calculationId),
                number = req.number,
                type = InvoiceType.valueOf(req.type.uppercase())
            )
            call.respond(HttpStatusCode.Created, invoice.toResponse())
        }

        // --- Acts ---
        post("acts") {
            val req = call.receive<ActRequest>()
            val act = service.createAct(req.toDomain())
            call.respond(HttpStatusCode.Created, act.toResponse())
        }

        get("acts") {
            val contractId = call.request.queryParameters["contractId"] ?: throw IllegalArgumentException("contractId required")
            val acts = service.getActsByContract(UUID.fromString(contractId))
            call.respond(acts.map { it.toResponse() })
        }

        get("acts/{id}") {
            call.respond(service.getAct(UUID.fromString(call.parameters["id"])).toResponse())
        }

        put("acts/{id}") {
            val id = UUID.fromString(call.parameters["id"])
            val req = call.receive<ActRequest>()
            call.respond(service.updateAct(id, req.toDomain()).toResponse())
        }

        delete("acts/{id}") {
            service.deleteAct(UUID.fromString(call.parameters["id"]))
            call.respond(HttpStatusCode.NoContent)
        }
    }
}

private fun InvoiceRequest.toDomain() = Invoice(
    contractId = UUID.fromString(contractId),
    calculationId = calculationId?.let { UUID.fromString(it) },
    number = number, date = LocalDate.parse(date),
    type = InvoiceType.valueOf(type.uppercase()),
    items = items.map {
        InvoiceItem(name = it.name, unit = it.unit, quantity = it.quantity, price = it.price,
            amount = it.amount, vatRate = it.vatRate, vatAmount = it.vatAmount)
    },
    totalAmount = totalAmount, totalVat = totalVat, totalWithVat = totalWithVat,
    status = InvoiceStatus.valueOf(status.uppercase())
)

private fun Invoice.toResponse() = InvoiceResponse(
    id = id.toString(), contractId = contractId.toString(), calculationId = calculationId?.toString(),
    number = number, date = date.toString(), type = type.name,
    items = items.map {
        InvoiceItemDto(name = it.name, unit = it.unit, quantity = it.quantity, price = it.price,
            amount = it.amount, vatRate = it.vatRate, vatAmount = it.vatAmount)
    },
    totalAmount = totalAmount, totalVat = totalVat, totalWithVat = totalWithVat, status = status.name
)

private fun ActRequest.toDomain() = AcceptanceAct(
    contractId = UUID.fromString(contractId), calculationId = calculationId?.let { UUID.fromString(it) },
    number = number, date = LocalDate.parse(date),
    periodFrom = LocalDate.parse(periodFrom), periodTo = LocalDate.parse(periodTo),
    volume = volume, cost = cost, status = ActStatus.valueOf(status.uppercase())
)

private fun AcceptanceAct.toResponse() = ActResponse(
    id = id.toString(), contractId = contractId.toString(), calculationId = calculationId?.toString(),
    number = number, date = date.toString(), periodFrom = periodFrom.toString(), periodTo = periodTo.toString(),
    volume = volume, cost = cost, status = status.name
)

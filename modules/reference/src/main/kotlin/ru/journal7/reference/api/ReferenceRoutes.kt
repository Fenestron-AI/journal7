package ru.journal7.reference.api

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.koin.ktor.ext.inject
import ru.journal7.reference.api.dto.*
import ru.journal7.reference.application.CounterpartyService
import ru.journal7.reference.domain.Counterparty
import ru.journal7.reference.domain.CounterpartyType
import java.util.UUID

fun Route.referenceRoutes() {
    val counterpartyService by inject<CounterpartyService>()

    route("/api/v1/reference") {
        counterpartyRoutes(counterpartyService)
    }
}

private fun Route.counterpartyRoutes(service: CounterpartyService) {
    route("/counterparties") {
        get {
            val query = call.request.queryParameters["q"] ?: ""
            val type = call.request.queryParameters["type"]
            val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
            val size = call.request.queryParameters["size"]?.toIntOrNull() ?: 20

            val result = service.search(query, type, page, size)

            call.respond(
                CounterpartyListResponse(
                    items = result.items.map { it.toResponse() },
                    total = result.total,
                    page = result.page,
                    size = result.size,
                    totalPages = result.totalPages
                )
            )
        }

        get("{id}") {
            val id = UUID.fromString(call.parameters["id"])
            val counterparty = service.getById(id)
            call.respond(counterparty.toResponse())
        }

        post {
            val request = call.receive<CounterpartyRequest>()
            val counterparty = service.create(request.toDomain())
            call.respond(HttpStatusCode.Created, counterparty.toResponse())
        }

        put("{id}") {
            val id = UUID.fromString(call.parameters["id"])
            val request = call.receive<CounterpartyRequest>()
            val counterparty = service.update(id, request.toDomain())
            call.respond(counterparty.toResponse())
        }

        delete("{id}") {
            val id = UUID.fromString(call.parameters["id"])
            service.delete(id)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}

private fun CounterpartyRequest.toDomain() = Counterparty(
    code = code,
    name = name,
    fullName = fullName,
    inn = inn,
    kpp = kpp,
    ogrn = ogrn,
    legalAddress = legalAddress,
    postalAddress = postalAddress,
    phone = phone,
    email = email,
    bankName = bankName,
    bankBik = bankBik,
    bankKs = bankKs,
    bankRs = bankRs,
    type = CounterpartyType.valueOf(type.uppercase())
)

private fun Counterparty.toResponse() = CounterpartyResponse(
    id = id.toString(),
    code = code,
    name = name,
    fullName = fullName,
    inn = inn,
    kpp = kpp,
    ogrn = ogrn,
    legalAddress = legalAddress,
    postalAddress = postalAddress,
    phone = phone,
    email = email,
    bankName = bankName,
    bankBik = bankBik,
    bankKs = bankKs,
    bankRs = bankRs,
    type = type.name
)

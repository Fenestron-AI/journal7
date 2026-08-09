package ru.journal7.calculation.api

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.koin.ktor.ext.inject
import ru.journal7.calculation.api.dto.*
import ru.journal7.calculation.application.CalculationService
import ru.journal7.calculation.domain.*
import java.time.LocalDate
import java.util.UUID

fun Route.calculationRoutes() {
    val service by inject<CalculationService>()

    route("/api/v1/calculations/sale") {
        post {
            val body = call.receive<RunCalculationRequest>()
            val contractId = call.request.queryParameters["contractId"]
                ?: throw IllegalArgumentException("contractId is required")

            val tariffRates = TariffRates(
                singleRate = body.tariffRates.singleRate,
                peakRate = body.tariffRates.peakRate,
                halfPeakRate = body.tariffRates.halfPeakRate,
                offPeakRate = body.tariffRates.offPeakRate,
                hourlyRates = body.tariffRates.hourlyRates.mapKeys { LocalDate.parse(it.key) }
                    .mapValues { (_, hours) -> hours.mapKeys { it.key.toInt() }.mapValues { it.value.toDouble() } }
            )

            val result = service.runCalculation(
                contractId = UUID.fromString(contractId),
                profileId = UUID.fromString(body.profileId),
                tariffRates = tariffRates,
                salesMarkup = body.salesMarkup,
                omCoefficient = body.omCoefficient,
                infrastructurePayment = body.infrastructurePayment,
                peakHours = body.peakHours?.toSet(),
                halfPeakHours = body.halfPeakHours?.toSet()
            )

            call.respond(HttpStatusCode.Created, result.toResponse())
        }

        get {
            val contractId = call.request.queryParameters["contractId"]
                ?: throw IllegalArgumentException("contractId is required")

            val results = service.getCalculationsByContract(UUID.fromString(contractId))
            call.respond(
                CalculationListResponse(
                    items = results.map { it.toResponse() },
                    total = results.size
                )
            )
        }

        get("{id}") {
            val id = UUID.fromString(call.parameters["id"])
            call.respond(service.getCalculation(id).toResponse())
        }

        delete("{id}") {
            val id = UUID.fromString(call.parameters["id"])
            service.deleteCalculation(id)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}

private fun CalculationResult.toResponse() = CalculationResultResponse(
    id = id.toString(),
    contractId = contractId.toString(),
    priceCategory = priceCategory.name,
    status = status.name,
    periodFrom = periodFrom.toString(),
    periodTo = periodTo.toString(),
    totalVolume = totalVolume,
    totalCost = totalCost,
    costPerMwh = costPerMwh,
    hourlyResults = hourlyResults.map {
        HourlyResultDto(date = it.date.toString(), hour = it.hour, volume = it.volume, price = it.price, cost = it.cost, zone = it.zone)
    },
    zoneResults = zoneResults.mapValues { (_, zr) ->
        ZoneResultDto(zone = zr.zone, volume = zr.volume, rate = zr.rate, cost = zr.cost)
    }
)

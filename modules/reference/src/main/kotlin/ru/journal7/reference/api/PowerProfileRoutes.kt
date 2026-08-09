package ru.journal7.reference.api

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.koin.ktor.ext.inject
import ru.journal7.reference.api.dto.*
import ru.journal7.reference.application.PowerProfileService
import ru.journal7.reference.domain.PowerProfile
import ru.journal7.reference.domain.PowerProfileType
import ru.journal7.reference.domain.PowerProfileValue
import java.time.LocalDate
import java.util.UUID

fun Route.powerProfileRoutes() {
    val service by inject<PowerProfileService>()

    route("/api/v1/reference/power-profiles") {
        get {
            val q = call.request.queryParameters["q"] ?: ""
            val t = call.request.queryParameters["type"]
            val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
            val size = call.request.queryParameters["size"]?.toIntOrNull() ?: 20

            val (items, total) = service.search(q, t, page, size)

            call.respond(
                PowerProfileListResponse(
                    items = items.map { it.toResponse() },
                    total = total,
                    page = page,
                    size = size
                )
            )
        }

        get("{id}") {
            val id = UUID.fromString(call.parameters["id"])
            call.respond(service.getById(id).toResponse())
        }

        post {
            val request = call.receive<PowerProfileRequest>()
            val profile = service.create(request.toDomain())
            call.respond(HttpStatusCode.Created, profile.toResponse())
        }

        put("{id}") {
            val id = UUID.fromString(call.parameters["id"])
            val request = call.receive<PowerProfileRequest>()
            call.respond(service.update(id, request.toDomain()).toResponse())
        }

        delete("{id}") {
            val id = UUID.fromString(call.parameters["id"])
            service.delete(id)
            call.respond(HttpStatusCode.NoContent)
        }

        get("{id}/values") {
            val id = UUID.fromString(call.parameters["id"])
            val from = call.request.queryParameters["from"]?.let { LocalDate.parse(it) }
                ?: LocalDate.now().withDayOfMonth(1)
            val to = call.request.queryParameters["to"]?.let { LocalDate.parse(it) }
                ?: LocalDate.now()

            val values = service.getValues(id, from, to)
            call.respond(
                PowerProfileHeatmapResponse(
                    profileId = id.toString(),
                    from = from.toString(),
                    to = to.toString(),
                    data = values.map {
                        PowerProfileValueItem(date = it.periodDate.toString(), hour = it.hour, value = it.value)
                    }
                )
            )
        }

        put("{id}/values") {
            val id = UUID.fromString(call.parameters["id"])
            val items = call.receive<List<PowerProfileValueItem>>()
            val count = service.upsertValues(id, items.map {
                PowerProfileValue(profileId = id, periodDate = LocalDate.parse(it.date), hour = it.hour, value = it.value)
            })
            call.respond(mapOf("upserted" to count))
        }

        get("{id}/stats") {
            val id = UUID.fromString(call.parameters["id"])
            val from = call.request.queryParameters["from"]?.let { LocalDate.parse(it) }
                ?: LocalDate.now().withDayOfMonth(1)
            val to = call.request.queryParameters["to"]?.let { LocalDate.parse(it) }
                ?: LocalDate.now()

            val stats = service.getHourlyStats(id, from, to)
            call.respond(stats.map {
                PowerProfileHourlyStatsResponse(hour = it.hour, avg = it.avg, min = it.min, max = it.max, stddev = it.stddev)
            })
        }

        get("{id}/heatmap") {
            val id = UUID.fromString(call.parameters["id"])
            val from = call.request.queryParameters["from"]?.let { LocalDate.parse(it) }
                ?: LocalDate.now().withDayOfMonth(1)
            val to = call.request.queryParameters["to"]?.let { LocalDate.parse(it) }
                ?: LocalDate.now()

            val data = service.getHeatmapData(id, from, to)
            call.respond(
                PowerProfileHeatmapResponse(
                    profileId = id.toString(),
                    from = from.toString(),
                    to = to.toString(),
                    data = data.map {
                        PowerProfileValueItem(date = it.date.toString(), hour = it.hour, value = it.value)
                    }
                )
            )
        }

        post("{id}/validate") {
            val id = UUID.fromString(call.parameters["id"])
            val from = call.request.queryParameters["from"]?.let { LocalDate.parse(it) }
                ?: LocalDate.now().withDayOfMonth(1)
            val to = call.request.queryParameters["to"]?.let { LocalDate.parse(it) }
                ?: LocalDate.now()

            val result = service.validate(id, from, to)
            call.respond(
                PowerProfileValidationResponse(
                    profileId = result.profileId.toString(),
                    totalValues = result.totalValues,
                    missingHours = result.missingHours.map { it.toString() },
                    anomalies = result.anomalies.map {
                        PowerProfileValidationResponse.AnomalyItem(date = it.date.toString(), hour = it.hour, value = it.value, reason = it.reason)
                    },
                    gaps = result.gaps.map {
                        PowerProfileValidationResponse.GapItem(from = it.from.toString(), to = it.to.toString(), missingHours = it.missingHours)
                    },
                    isValid = result.isValid
                )
            )
        }
    }
}

private fun PowerProfileRequest.toDomain() = PowerProfile(
    code = code,
    name = name,
    type = PowerProfileType.valueOf(type.uppercase()),
    regionId = regionId?.let { UUID.fromString(it) },
    unit = unit
)

private fun PowerProfile.toResponse() = PowerProfileResponse(
    id = id.toString(),
    code = code,
    name = name,
    type = type.name,
    regionId = regionId?.toString(),
    unit = unit,
    minValue = minValue,
    maxValue = maxValue,
    avgValue = avgValue,
    valueCount = valueCount
)

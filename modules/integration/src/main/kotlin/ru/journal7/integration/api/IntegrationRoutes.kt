package ru.journal7.integration.api

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.utils.io.*
import org.koin.ktor.ext.inject
import ru.journal7.integration.application.ImportService
import java.util.UUID

fun Route.integrationRoutes() {
    val importService by inject<ImportService>()

    route("/api/v1/integration") {
        post("import/counterparties") {
            val channel = call.receiveChannel()
            val data = channel.toByteArray()
            val result = importService.importCounterparties(data.inputStream())
            call.respond(result)
        }

        post("import/power-profiles/{profileId}") {
            val profileId = UUID.fromString(call.parameters["profileId"])
            val channel = call.receiveChannel()
            val data = channel.toByteArray()
            val result = importService.importPowerProfileValues(profileId, data.inputStream())
            call.respond(result)
        }
    }
}

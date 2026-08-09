package ru.journal7.ai.api

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.koin.ktor.ext.inject
import ru.journal7.ai.api.dto.*
import ru.journal7.ai.application.AiService
import ru.journal7.ai.application.DocumentWatcher
import ru.journal7.ai.domain.*
import java.io.File
import java.util.UUID

fun Route.aiRoutes() {
    val aiService by inject<AiService>()
    val watcher by inject<DocumentWatcher>()
    val workerClient by inject<ru.journal7.ai.infrastructure.AiWorkerClient>()

    route("/api/v1/ai") {
        // --- Sync ---
        post("sync") {
            val ok = workerClient.downloadAll() // reuse download endpoint for now
            call.respond(mapOf("started" to ok))
        }

        get("activity") {
            val docs = aiService.listDocuments(null)
            val count = docs.count { it.status in setOf(DocumentStatus.MISSING, DocumentStatus.PROCESSING, DocumentStatus.ERROR, DocumentStatus.DOWNLOADING) }
            call.respond(mapOf("count" to count))
        }
        // --- Documents ---
        get("documents") {
            val status = call.request.queryParameters["status"]
            val docs = aiService.listDocuments(status)
            call.respond(docs.map { it.toResponse() })
        }

        get("documents/{id}") {
            val id = UUID.fromString(call.parameters["id"])
            call.respond(aiService.getDocument(id).toResponse())
        }

        delete("documents/{id}") {
            val id = UUID.fromString(call.parameters["id"])
            aiService.deleteDocument(id)
            call.respond(HttpStatusCode.NoContent)
        }

        post("documents/{id}/ingest") {
            val id = UUID.fromString(call.parameters["id"])
            aiService.startIngest(id)
            call.respond(mapOf("status" to "started"))
        }

        post("documents/{id}/cancel") {
            val id = UUID.fromString(call.parameters["id"])
            aiService.cancelIngest(id)
            call.respond(mapOf("status" to "cancelled"))
        }

        post("documents/refresh") {
            watcher.scan()
            call.respond(mapOf("status" to "scanning"))
        }

        // --- Q&A ---
        post("ask") {
            val req = call.receive<QaRequestDto>()
            val resp = aiService.ask(req.question)
            call.respond(resp.toResponse())
        }

        post("chat") {
            val req = call.receive<ChatRequestDto>()
            val history = req.messages.map { ChatMessage(it.role, it.content) }
            val question = req.messages.lastOrNull()?.content ?: ""
            val resp = aiService.ask(question, history.dropLast(1))
            call.respond(resp.toResponse())
        }

        get("health") {
            call.respond(mapOf("worker" to aiService.workerHealthy()))
        }

        // --- Notifications ---
        get("notifications") {
            val read = call.request.queryParameters["read"]?.toBooleanStrictOrNull()
            call.respond(aiService.listNotifications(read).map { it.toResponse() })
        }

        post("notifications/{id}/read") {
            val id = UUID.fromString(call.parameters["id"])
            aiService.markNotificationRead(id)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}

private fun LegalDocument.toResponse() = DocumentResponse(
    id = id.toString(),
    title = title,
    docNumber = docNumber,
    docDate = docDate,
    revision = revision,
    docType = docType,
    status = status.name,
    filePath = filePath,
    chunkCount = chunkCount,
    canonical = canonical,
    originalFilename = originalFilename,
    fileSize = fileSize,
    source = source,
    sourceUrl = sourceUrl,
    metadata = metadata,
)

private fun QaResponse.toResponse() = QaResponseDto(
    answer = answer,
    sources = sources.map {
        SourceRefDto(
            documentId = it.documentId,
            title = it.title,
            docNumber = it.docNumber,
            chunkIndex = it.chunkIndex,
            text = it.text,
        )
    }
)

private fun AiNotification.toResponse() = NotificationDto(
    id = id.toString(),
    docNumber = docNumber,
    title = title,
    message = message,
    read = read,
)

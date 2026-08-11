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
            val json = workerClient.syncSource()
            call.respondText(json, ContentType.Application.Json)
        }

        post("sync/pause") {
            val ok = workerClient.pauseDownload()
            call.respond(mapOf("paused" to ok))
        }

        post("sync/resume") {
            val ok = workerClient.resumeDownload()
            call.respond(mapOf("resumed" to ok))
        }

        post("upload") {
            val resp = workerClient.uploadFile(call)
            call.respondText(resp, ContentType.Application.Json)
        }

        post("documents/batch-delete") {
            val payload = call.receiveText()
            val resp = workerClient.batchDelete(payload)
            call.respondText(resp, ContentType.Application.Json)
        }

        post("documents/{id}/pin") {
            val id = call.parameters["id"]!!
            val resp = workerClient.pinDocument(id)
            call.respondText(resp, ContentType.Application.Json)
        }

        get("activity") {
            val json = workerClient.getActivity()
            call.respondText(json, ContentType.Application.Json)
        }

        post("activity/clear") {
            val json = workerClient.clearActivity()
            call.respondText(json, ContentType.Application.Json)
        }

        get("sync/status") {
            call.respond(mapOf("paused" to workerClient.downloadStatus()))
        }

        // --- Sources ---
        get("sources") {
            val json = workerClient.getSources()
            call.respondText(json, ContentType.Application.Json)
        }

        post("sources") {
            val payload = call.receiveText()
            workerClient.createSource(payload)
            call.respond(mapOf("created" to true))
        }

        put("sources/{id}") {
            val id = call.parameters["id"]!!
            val payload = call.receiveText()
            workerClient.updateSource(id, payload)
            call.respond(mapOf("updated" to true))
        }

        delete("sources/{id}") {
            val id = call.parameters["id"]!!
            workerClient.deleteSource(id)
            call.respond(mapOf("deleted" to true))
        }

        get("activity") {
            val docs = aiService.listDocuments(null)
            val count = docs.count { it.status == DocumentStatus.TRACKED && it.downloadState in setOf("downloading", "error") || it.processingState == "processing" }
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

        // --- File serving ---
        get("files/{filename}") {
            val filename = call.parameters["filename"]!!
            val base = File("/home/fenestron/Developer/journal7/data/legal-docs")
            if (!base.exists()) {
                call.respond(HttpStatusCode.NotFound, "Base directory not found")
                return@get
            }
            for (dir in base.listFiles() ?: emptyArray()) {
                if (!dir.isDirectory) continue
                val file = File(dir, filename)
                if (file.exists() && file.isFile) {
                    val contentType = when (file.extension.lowercase()) {
                        "pdf" -> ContentType.Application.Pdf
                        "docx" -> ContentType.Application.Zip // docx as octet-stream for download
                        "odt" -> ContentType.Application.Zip
                        "rtf" -> ContentType.Text.Plain
                        "doc" -> ContentType.Application.Zip
                        else -> ContentType.Application.OctetStream
                    }
                    call.response.header("Content-Disposition", "inline; filename=\"${file.name}\"")
                    call.respondFile(file)
                    return@get
                }
            }
            call.respond(HttpStatusCode.NotFound, "File not found: $filename")
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
    docCategory = docCategory,
    syncInterval = syncInterval,
    status = status.name,
    downloadState = downloadState,
    processingState = processingState,
    priority = priority,
    pinned = pinned,
    filePath = filePath,
    chunkCount = chunkCount,
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

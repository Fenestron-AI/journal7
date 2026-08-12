package ru.journal7.ai.infrastructure

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.request.forms.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.http.content.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json as KJson

@Serializable
data class WorkerIngestRequest(
    val documentId: String,
    val filePath: String,
)

@Serializable
data class WorkerStatusResponse(
    val taskId: String? = null,
    val status: String,
    val chunks: Int = 0,
)

@Serializable
data class DownloadStatusResponse(
    val paused: Boolean = false,
)

@Serializable
data class WorkerAskRequest(
    val question: String,
    val history: List<WorkerMessage> = emptyList(),
)

@Serializable
data class WorkerMessage(
    val role: String,
    val content: String,
)

@Serializable
data class WorkerAskResponse(
    val answer: String,
    val sources: List<WorkerSource> = emptyList(),
)

@Serializable
data class WorkerSource(
    val documentId: String,
    val title: String,
    val docNumber: String? = null,
    val chunkIndex: Int,
    val text: String,
)

class AiWorkerClient(
    private val baseUrl: String = "http://localhost:8000",
) {
    private val json = KJson { ignoreUnknownKeys = true }
    private val client = HttpClient(CIO) {
        expectSuccess = false
    }

    suspend fun ingest(documentId: String, filePath: String): WorkerStatusResponse {
        val resp = client.post("$baseUrl/ingest") {
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(WorkerIngestRequest.serializer(), WorkerIngestRequest(documentId, filePath)))
        }
        return json.decodeFromString(WorkerStatusResponse.serializer(), resp.bodyAsText())
    }

    suspend fun ask(question: String, history: List<WorkerMessage> = emptyList()): WorkerAskResponse {
        val resp = client.post("$baseUrl/ask") {
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(WorkerAskRequest.serializer(), WorkerAskRequest(question, history)))
        }
        return json.decodeFromString(WorkerAskResponse.serializer(), resp.bodyAsText())
    }

    suspend fun checkHealth(): Boolean {
        return try {
            val resp = client.get("$baseUrl/health")
            resp.status.isSuccess()
        } catch (_: Exception) {
            false
        }
    }

    suspend fun downloadAll(): Boolean {
        return try {
            val resp = client.post("$baseUrl/download")
            resp.status.isSuccess()
        } catch (_: Exception) { false }
    }

    suspend fun pauseDownload(): Boolean {
        return try {
            val resp = client.post("$baseUrl/download/pause")
            resp.status.isSuccess()
        } catch (_: Exception) { false }
    }

    suspend fun resumeDownload(): Boolean {
        return try {
            val resp = client.post("$baseUrl/download/resume")
            resp.status.isSuccess()
        } catch (_: Exception) { false }
    }

    suspend fun downloadStatus(): Boolean {
        return try {
            val resp = client.get("$baseUrl/download/status")
            val body = json.decodeFromString(DownloadStatusResponse.serializer(), resp.bodyAsText())
            body.paused
        } catch (_: Exception) { false }
    }

    suspend fun syncSource(sourceId: String? = null): String {
        val resp = client.post("$baseUrl/sync") {
            contentType(ContentType.Application.Json)
            if (sourceId != null) setBody("{\"source_id\":\"$sourceId\"}")
            else setBody("{}")
        }
        return resp.bodyAsText()
    }

    suspend fun getSyncState(): String {
        val resp = client.get("$baseUrl/sync/state")
        return resp.bodyAsText()
    }

    suspend fun cancelSync(): String {
        val resp = client.post("$baseUrl/sync/cancel")
        return resp.bodyAsText()
    }

    suspend fun getSchedulerState(): String {
        val resp = client.get("$baseUrl/scheduler")
        return resp.bodyAsText()
    }

    suspend fun setSchedulerState(payload: String): String {
        val resp = client.post("$baseUrl/scheduler") {
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        return resp.bodyAsText()
    }

    suspend fun getSources(): String {
        val resp = client.get("$baseUrl/sources")
        return resp.bodyAsText()
    }

    suspend fun createSource(payload: String): Boolean {
        val resp = client.post("$baseUrl/sources") {
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        return resp.status.isSuccess()
    }

    suspend fun updateSource(sourceId: String, payload: String): Boolean {
        val resp = client.put("$baseUrl/sources/$sourceId") {
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        return resp.status.isSuccess()
    }

    suspend fun deleteSource(sourceId: String): Boolean {
        val resp = client.delete("$baseUrl/sources/$sourceId")
        return resp.status.isSuccess()
    }

    suspend fun uploadFile(call: io.ktor.server.application.ApplicationCall): String {
        val mp = call.receiveMultipart()
        var docId: String? = null
        var title: String? = null
        var docNumber: String? = null
        var description: String? = null
        var fileBytes: ByteArray? = null
        var fileName: String? = null

        while (true) {
            val part = mp.readPart() ?: break
            when {
                part.name == "doc_id" -> docId = (part as? PartData.FormItem)?.value
                part.name == "title" -> title = (part as? PartData.FormItem)?.value
                part.name == "doc_number" -> docNumber = (part as? PartData.FormItem)?.value
                part.name == "description" -> description = (part as? PartData.FormItem)?.value
                part is PartData.FileItem -> {
                    fileBytes = part.streamProvider().readBytes()
                    fileName = part.originalFileName
                }
                else -> part.dispose()
            }
        }

        val workerResp = client.post("$baseUrl/upload") {
            setBody(io.ktor.client.request.forms.MultiPartFormDataContent(io.ktor.client.request.forms.formData {
                if (docId != null) append("doc_id", docId)
                if (title != null) append("title", title)
                if (docNumber != null) append("doc_number", docNumber)
                if (description != null) append("description", description)
                append("file", fileBytes!!, io.ktor.http.Headers.build {
                    append(io.ktor.http.HttpHeaders.ContentDisposition, "filename=\"$fileName\"")
                    append(io.ktor.http.HttpHeaders.ContentType, "application/octet-stream")
                })
            }))
        }
        return workerResp.bodyAsText()
    }

    suspend fun batchDelete(payload: String): String {
        val resp = client.post("$baseUrl/documents/batch-delete") {
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        return resp.bodyAsText()
    }

    suspend fun pinDocument(docId: String): String {
        val resp = client.post("$baseUrl/documents/$docId/pin")
        return resp.bodyAsText()
    }

    suspend fun setDocumentUrl(docId: String, payload: String): String {
        val resp = client.post("$baseUrl/documents/$docId/set-url") {
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        return resp.bodyAsText()
    }

    suspend fun getActivity(): String {
        val resp = client.get("$baseUrl/activity")
        return resp.bodyAsText()
    }

    suspend fun clearActivity(): String {
        val resp = client.post("$baseUrl/activity/clear")
        return resp.bodyAsText()
    }

    suspend fun forgetDocuments(payload: String): String {
        val resp = client.post("$baseUrl/documents/forget") {
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        return resp.bodyAsText()
    }

    suspend fun unforgetDocuments(payload: String): String {
        val resp = client.post("$baseUrl/documents/unforget") {
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        return resp.bodyAsText()
    }

    suspend fun setCategory(payload: String): String {
        val resp = client.post("$baseUrl/documents/category") {
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        return resp.bodyAsText()
    }

    suspend fun getDiffs(): String {
        val resp = client.get("$baseUrl/diffs")
        return resp.bodyAsText()
    }

    suspend fun acknowledgeDiffs(payload: String): String {
        val resp = client.post("$baseUrl/diffs/acknowledge") {
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        return resp.bodyAsText()
    }

    suspend fun listCatalogRules(): String {
        val resp = client.get("$baseUrl/catalog-rules")
        return resp.bodyAsText()
    }

    suspend fun createCatalogRule(payload: String): String {
        val resp = client.post("$baseUrl/catalog-rules") {
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        return resp.bodyAsText()
    }

    suspend fun updateCatalogRule(ruleId: String, payload: String): String {
        val resp = client.put("$baseUrl/catalog-rules/$ruleId") {
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        return resp.bodyAsText()
    }

    suspend fun deleteCatalogRule(ruleId: String): String {
        val resp = client.delete("$baseUrl/catalog-rules/$ruleId")
        return resp.bodyAsText()
    }

    suspend fun listFileSources(): String {
        val resp = client.get("$baseUrl/file-sources")
        return resp.bodyAsText()
    }

    suspend fun createFileSource(payload: String): String {
        val resp = client.post("$baseUrl/file-sources") {
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        return resp.bodyAsText()
    }

    suspend fun updateFileSource(sourceId: String, payload: String): String {
        val resp = client.put("$baseUrl/file-sources/$sourceId") {
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        return resp.bodyAsText()
    }

    suspend fun deleteFileSource(sourceId: String): String {
        val resp = client.delete("$baseUrl/file-sources/$sourceId")
        return resp.bodyAsText()
    }
}

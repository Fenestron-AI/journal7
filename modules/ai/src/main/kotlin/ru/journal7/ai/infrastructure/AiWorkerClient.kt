package ru.journal7.ai.infrastructure

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
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
}

package ru.journal7.ai.domain

import kotlinx.serialization.Serializable
import kotlinx.serialization.Contextual
import ru.journal7.core.types.UuidEntity
import java.util.UUID

enum class DocumentStatus { TRACKED, INGESTED, ARCHIVED }
enum class DownloadState { downloading, downloaded, error }
enum class ProcessingState { processing, done, error }

@Serializable
data class LegalDocument(
    @Contextual val id: UUID,
    val title: String,
    val docNumber: String? = null,
    val docDate: String? = null,
    val revision: String? = null,
    val docType: String = "НПА",
    val docCategory: String? = null,
    val syncInterval: String? = null,
    val status: DocumentStatus = DocumentStatus.TRACKED,
    val downloadState: String? = null,
    val processingState: String? = null,
    val priority: String = "normal",
    val pinned: Boolean = false,
    val filePath: String? = null,
    val fileHash: String? = null,
    val chunkCount: Int = 0,
    val originalFilename: String? = null,
    val fileSize: Long = 0,
    val source: String = "so-ups.ru",
    val sourceUrl: String? = null,
    val metadata: Map<String, String> = emptyMap(),
)

@Serializable
data class DocumentChunk(
    @Contextual val id: UUID,
    @Contextual val documentId: UUID,
    val chunkIndex: Int,
    val content: String,
    val metadata: Map<String, String> = emptyMap(),
)

@Serializable
data class QaRequest(val question: String)

@Serializable
data class ChatMessage(
    val role: String, // system | user | assistant
    val content: String,
)

@Serializable
data class ChatRequest(
    val messages: List<ChatMessage>,
)

@Serializable
data class SourceRef(
    val documentId: String,
    val title: String,
    val docNumber: String?,
    val chunkIndex: Int,
    val text: String,
)

@Serializable
data class QaResponse(
    val answer: String,
    val sources: List<SourceRef> = emptyList(),
)

@Serializable
data class AiNotification(
    @Contextual val id: UUID,
    val docNumber: String,
    val title: String,
    val message: String,
    val read: Boolean,
)

@Serializable
data class ValidateFormRequest(
    val formType: String,
    val fields: List<String>,
)

@Serializable
data class ValidateFormResponse(
    val compliant: Boolean,
    val missing: List<String> = emptyList(),
    val requiredBy: List<String> = emptyList(),
)

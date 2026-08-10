package ru.journal7.ai.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class DocumentResponse(
    val id: String,
    val title: String,
    val docNumber: String? = null,
    val docDate: String? = null,
    val revision: String? = null,
    val docType: String,
    val docCategory: String? = null,
    val syncInterval: String? = null,
    val status: String,
    val downloadState: String? = null,
    val processingState: String? = null,
    val priority: String = "normal",
    val pinned: Boolean = false,
    val filePath: String? = null,
    val chunkCount: Int = 0,
    val originalFilename: String? = null,
    val fileSize: Long = 0,
    val source: String = "",
    val sourceUrl: String? = null,
    val metadata: Map<String, String> = emptyMap(),
)

@Serializable
data class QaRequestDto(val question: String)

@Serializable
data class ChatRequestDto(
    val messages: List<MessageDto>,
)

@Serializable
data class MessageDto(
    val role: String,
    val content: String,
)

@Serializable
data class QaResponseDto(
    val answer: String,
    val sources: List<SourceRefDto> = emptyList(),
)

@Serializable
data class SourceRefDto(
    val documentId: String,
    val title: String,
    val docNumber: String? = null,
    val chunkIndex: Int,
    val text: String,
)

@Serializable
data class NotificationDto(
    val id: String,
    val docNumber: String,
    val title: String,
    val message: String,
    val read: Boolean,
)

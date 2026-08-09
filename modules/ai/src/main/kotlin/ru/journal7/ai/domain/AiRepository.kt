package ru.journal7.ai.domain

import ru.journal7.core.types.DomainError
import java.util.UUID

interface AiRepository {
    suspend fun findDocumentById(id: UUID): LegalDocument?
    suspend fun listDocuments(status: String?): List<LegalDocument>
    suspend fun findDocumentByNumberAndRevision(docNumber: String, revision: String?): LegalDocument?
    suspend fun createDocument(doc: LegalDocument): LegalDocument
    suspend fun updateDocument(doc: LegalDocument): LegalDocument
    suspend fun setDocumentStatus(id: UUID, status: DocumentStatus)
    suspend fun deleteDocument(id: UUID)

    suspend fun listChunks(documentId: UUID): List<DocumentChunk>
    suspend fun deleteChunks(documentId: UUID)
    suspend fun insertChunks(chunks: List<DocumentChunk>)

    suspend fun searchSimilar(queryEmbedding: List<Float>, limit: Int = 5): List<SimilarChunk>
    suspend fun findTextChunks(keywords: String, limit: Int = 5): List<DocumentChunk>

    suspend fun createNotification(n: AiNotification)
    suspend fun listNotifications(read: Boolean?): List<AiNotification>
    suspend fun markNotificationRead(id: UUID)
}

data class SimilarChunk(
    val chunk: DocumentChunk,
    val document: LegalDocument,
    val score: Double,
)

class DocumentNotFound(message: String = "Document not found") : DomainError.NotFound(message)
class DocumentAlreadyExists(message: String = "Document with this number and revision already exists") : DomainError.Conflict(message)

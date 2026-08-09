package ru.journal7.ai.application

import ru.journal7.ai.domain.*
import java.io.File
import java.nio.file.Files
import java.security.MessageDigest
import java.util.UUID

class AiService(
    private val repository: AiRepository,
    private val worker: ru.journal7.ai.infrastructure.AiWorkerClient,
) {

    suspend fun listDocuments(status: String?): List<LegalDocument> =
        repository.listDocuments(status)

    suspend fun getDocument(id: UUID): LegalDocument =
        repository.findDocumentById(id) ?: throw DocumentNotFound()

    suspend fun deleteDocument(id: UUID) {
        repository.findDocumentById(id) ?: throw DocumentNotFound()
        repository.deleteDocument(id)
    }

    /**
     * Register a document from the watch directory (file already on disk).
     * Called by DocumentWatcher. Doesn't call the worker directly — worker
     * ingests from file_path after registration.
     */
    suspend fun registerFromFile(file: File): LegalDocument {
        val parsed = parseDocumentMetadata(file.name)
        val existing = repository.findDocumentByNumberAndRevision(parsed.number ?: file.name, parsed.revision)

        if (existing != null) {
            // Same doc + revision: check if hash changed → re-ingest
            val hash = sha256(file)
            if (existing.fileHash == hash) {
                return existing // unchanged, skip
            }
            val updated = existing.copy(
                filePath = file.absolutePath,
                fileHash = hash,
                status = DocumentStatus.PROCESSING,
            )
            return repository.updateDocument(updated)
        }

        // If an older revision exists → supersede it
        if (parsed.number != null) {
            val older = repository.listDocuments(null)
                .firstOrNull { it.docNumber == parsed.number && it.status == DocumentStatus.ACTIVE }
            if (older != null) {
                repository.setDocumentStatus(older.id, DocumentStatus.SUPERSEDED)
                repository.createNotification(
                    AiNotification(
                        id = UUID.randomUUID(),
                        docNumber = parsed.number,
                        title = parsed.title ?: file.name,
                        message = "Новая редакция документа: ${parsed.revision ?: "неизвестна"}",
                        read = false,
                    )
                )
            }
        }

        val hash = sha256(file)
        val doc = LegalDocument(
            id = UUID.randomUUID(),
            title = parsed.title ?: file.name,
            docNumber = parsed.number,
            docDate = parsed.date,
            revision = parsed.revision,
            docType = parsed.type ?: "НПА",
            status = DocumentStatus.PROCESSING,
            filePath = file.absolutePath,
            fileHash = hash,
            metadata = mapOf("filename" to file.name),
        )
        return repository.createDocument(doc)
    }

    /**
     * Ask the AI worker a question with RAG over the legal documents.
     */
    suspend fun ask(question: String, history: List<ChatMessage> = emptyList()): QaResponse {
        val workerHistory = history
            .filter { it.role != "system" }
            .map { ru.journal7.ai.infrastructure.WorkerMessage(it.role, it.content) }

        val workerResp = worker.ask(question, workerHistory)
        return QaResponse(
            answer = workerResp.answer,
            sources = workerResp.sources.map {
                SourceRef(
                    documentId = it.documentId,
                    title = it.title,
                    docNumber = it.docNumber,
                    chunkIndex = it.chunkIndex,
                    text = it.text,
                )
            }
        )
    }

    suspend fun workerHealthy(): Boolean = worker.checkHealth()

    suspend fun listNotifications(read: Boolean?): List<AiNotification> =
        repository.listNotifications(read)

    suspend fun markNotificationRead(id: UUID) =
        repository.markNotificationRead(id)

    // --- Metadata parsing from filename like:
    // "Постановление Правительства РФ от 04.05.2012 N 442 _ред. от.rtf"
    private fun parseDocumentMetadata(filename: String): ParsedMeta {
        val base = filename.substringBeforeLast('.').replace('_', ' ')
        val number = Regex("""N\s*(\d+)""").find(base)?.groupValues?.get(1)
        val date = Regex("""от\s+(\d{2}\.\d{2}\.\d{4})""").find(base)?.groupValues?.get(1)
        val revision = Regex("""ред\.?\s*от\s*(\d{2}\.\d{2}\.\d{4})""").find(base)?.groupValues?.get(1)
        val title = base
            .replace(Regex("""\s+от\s+\d{2}\.\d{2}\.\d{4}.*"""), "")
            .replace(Regex("""\s+N\s*\d+.*"""), "")
            .trim()
        val type = when {
            title.contains("Постановление Правительства") -> "ПП РФ"
            title.contains("Федеральный закон") -> "ФЗ"
            title.contains("ГОСТ") -> "ГОСТ"
            title.contains("Приказ") -> "Приказ"
            title.contains("Письмо") -> "Письмо"
            else -> "НПА"
        }
        return ParsedMeta(title, number, date, revision, type)
    }

    private data class ParsedMeta(
        val title: String?,
        val number: String?,
        val date: String?,
        val revision: String?,
        val type: String?,
    )

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        Files.newInputStream(file.toPath()).use { input ->
            val buffer = ByteArray(8192)
            var read = input.read(buffer)
            while (read > 0) {
                digest.update(buffer, 0, read)
                read = input.read(buffer)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}

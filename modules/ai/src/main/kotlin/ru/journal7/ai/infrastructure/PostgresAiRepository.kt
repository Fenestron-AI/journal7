package ru.journal7.ai.infrastructure

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.like
import org.jetbrains.exposed.sql.transactions.transaction
import ru.journal7.ai.domain.*
import java.time.Instant
import java.util.UUID

object AiDocumentsTable : Table("ai.documents") {
    val id = uuid("id")
    val title = text("title")
    val docNumber = varchar("doc_number", 64).nullable()
    val docDate = varchar("doc_date", 64).nullable()
    val revision = varchar("revision", 128).nullable()
    val docType = varchar("doc_type", 32)
    val status = varchar("status", 32)
    val filePath = text("file_path").nullable()
    val fileHash = text("file_hash").nullable()
    val chunkCount = integer("chunk_count").default(0)
    val canonical = bool("canonical").default(false)
    val originalFilename = text("original_filename").nullable()
    val fileSize = long("file_size").default(0)
    val docSource = varchar("source", 64).default("so-ups.ru")
    val sourceUrl = text("source_url").nullable()
    val metadata = text("metadata")
    val createdAt = long("created_at")
    val updatedAt = long("updated_at")

    override val primaryKey = PrimaryKey(id)
}

object AiChunksTable : Table("ai.chunks") {
    val id = uuid("id")
    val documentId = uuid("document_id").references(AiDocumentsTable.id)
    val chunkIndex = integer("chunk_index")
    val content = text("content")
    val embedding = text("embedding").nullable() // stored as '[1,2,3]' string for pgvector
    val metadata = text("metadata")

    override val primaryKey = PrimaryKey(id)
}

object AiNotificationsTable : Table("ai.notifications") {
    val id = uuid("id")
    val docNumber = varchar("doc_number", 64)
    val title = text("title")
    val message = text("message")
    val read = bool("read").default(false)
    val createdAt = long("created_at")

    override val primaryKey = PrimaryKey(id)
}

class PostgresAiRepository : AiRepository {

    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun findDocumentById(id: UUID): LegalDocument? = transaction {
        AiDocumentsTable.selectAll().where { AiDocumentsTable.id eq id }
            .singleOrNull()?.toDocument()
    }

    override suspend fun listDocuments(status: String?): List<LegalDocument> = transaction {
        var q = AiDocumentsTable.selectAll()
        if (status != null) q = q.where { AiDocumentsTable.status eq status }
        q.orderBy(AiDocumentsTable.createdAt to SortOrder.DESC)
            .map { it.toDocument() }
    }

    override suspend fun findDocumentByNumberAndRevision(docNumber: String, revision: String?): LegalDocument? = transaction {
        val q = if (revision != null) {
            AiDocumentsTable.selectAll().where {
                (AiDocumentsTable.docNumber eq docNumber) and (AiDocumentsTable.revision eq revision)
            }
        } else {
            AiDocumentsTable.selectAll().where { AiDocumentsTable.docNumber eq docNumber }
        }
        q.singleOrNull()?.toDocument()
    }

    override suspend fun createDocument(doc: LegalDocument): LegalDocument = transaction {
        AiDocumentsTable.insert {
            it[id] = doc.id
            it[title] = doc.title
            it[docNumber] = doc.docNumber
            it[docDate] = doc.docDate
            it[revision] = doc.revision
            it[docType] = doc.docType
            it[status] = doc.status.name
            it[filePath] = doc.filePath
            it[fileHash] = doc.fileHash
            it[chunkCount] = doc.chunkCount
            it[metadata] = json.encodeToString(doc.metadata)
            it[createdAt] = Instant.now().toEpochMilli()
            it[updatedAt] = Instant.now().toEpochMilli()
        }
        doc
    }

    override suspend fun updateDocument(doc: LegalDocument): LegalDocument = transaction {
        AiDocumentsTable.update({ AiDocumentsTable.id eq doc.id }) {
            it[title] = doc.title
            it[docNumber] = doc.docNumber
            it[docDate] = doc.docDate
            it[revision] = doc.revision
            it[docType] = doc.docType
            it[status] = doc.status.name
            it[filePath] = doc.filePath
            it[fileHash] = doc.fileHash
            it[chunkCount] = doc.chunkCount
            it[metadata] = json.encodeToString(doc.metadata)
            it[updatedAt] = Instant.now().toEpochMilli()
        }
        doc
    }

    override suspend fun setDocumentStatus(id: UUID, status: DocumentStatus) {
        transaction {
            AiDocumentsTable.update({ AiDocumentsTable.id eq id }) {
                it[AiDocumentsTable.status] = status.name
                it[updatedAt] = Instant.now().toEpochMilli()
            }
        }
    }

    override suspend fun deleteDocument(id: UUID) {
        transaction {
            AiChunksTable.deleteWhere { AiChunksTable.documentId eq id }
            AiDocumentsTable.deleteWhere { AiDocumentsTable.id eq id }
        }
    }

    override suspend fun listChunks(documentId: UUID): List<DocumentChunk> = transaction {
        AiChunksTable.selectAll().where { AiChunksTable.documentId eq documentId }
            .orderBy(AiChunksTable.chunkIndex)
            .map { it.toChunk() }
    }

    override suspend fun deleteChunks(documentId: UUID) {
        transaction {
            AiChunksTable.deleteWhere { AiChunksTable.documentId eq documentId }
        }
    }

    override suspend fun insertChunks(chunks: List<DocumentChunk>) = transaction {
        chunks.forEach { c ->
            AiChunksTable.insert {
                it[id] = c.id
                it[documentId] = c.documentId
                it[chunkIndex] = c.chunkIndex
                it[content] = c.content
                it[metadata] = json.encodeToString(c.metadata)
            }
        }
    }

    override suspend fun searchSimilar(queryEmbedding: List<Float>, limit: Int): List<SimilarChunk> = transaction {
        // pgvector: cosine distance <->, order by distance, select nearest
        val vectorStr = queryEmbedding.joinToString(",") { it.toString() }
        val sql = """
            SELECT c.id, c.document_id, c.chunk_index, c.content, c.metadata,
                   1 - (c.embedding <=> '[$vectorStr]') AS score,
                   d.title, d.doc_number
            FROM ai.chunks c
            JOIN ai.documents d ON d.id = c.document_id
            WHERE c.embedding IS NOT NULL
            ORDER BY c.embedding <=> '[$vectorStr]'
            LIMIT $limit
        """.trimIndent()

        val result = mutableListOf<SimilarChunk>()
        exec(sql) { rs ->
            while (rs.next()) {
                result.add(
                    SimilarChunk(
                        chunk = DocumentChunk(
                            id = rs.getObject("id") as UUID,
                            documentId = rs.getObject("document_id") as UUID,
                            chunkIndex = rs.getInt("chunk_index"),
                            content = rs.getString("content"),
                            metadata = try { json.decodeFromString(rs.getString("metadata")) } catch (_: Exception) { emptyMap() },
                        ),
                        document = LegalDocument(
                            id = rs.getObject("document_id") as UUID,
                            title = rs.getString("title"),
                            docNumber = rs.getString("doc_number"),
                        ),
                        score = rs.getDouble("score")
                    )
                )
            }
        }
        result
    }

    override suspend fun findTextChunks(keywords: String, limit: Int): List<DocumentChunk> = transaction {
        AiChunksTable.selectAll()
            .where { AiChunksTable.content like "%$keywords%" }
            .limit(limit)
            .map { it.toChunk() }
    }

    override suspend fun createNotification(n: AiNotification) {
        transaction {
            AiNotificationsTable.insert {
                it[id] = n.id
                it[docNumber] = n.docNumber
                it[title] = n.title
                it[message] = n.message
                it[read] = n.read
                it[createdAt] = Instant.now().toEpochMilli()
            }
        }
    }

    override suspend fun listNotifications(read: Boolean?): List<AiNotification> = transaction {
        var q = AiNotificationsTable.selectAll()
        if (read != null) q = q.where { AiNotificationsTable.read eq read }
        q.orderBy(AiNotificationsTable.createdAt to SortOrder.DESC)
            .map {
                AiNotification(
                    id = it[AiNotificationsTable.id],
                    docNumber = it[AiNotificationsTable.docNumber],
                    title = it[AiNotificationsTable.title],
                    message = it[AiNotificationsTable.message],
                    read = it[AiNotificationsTable.read],
                )
            }
    }

    override suspend fun markNotificationRead(id: UUID) {
        transaction {
            AiNotificationsTable.update({ AiNotificationsTable.id eq id }) {
                it[read] = true
            }
        }
    }

    private fun ResultRow.toDocument() = LegalDocument(
        id = this[AiDocumentsTable.id],
        title = this[AiDocumentsTable.title],
        docNumber = this[AiDocumentsTable.docNumber],
        docDate = this[AiDocumentsTable.docDate],
        revision = this[AiDocumentsTable.revision],
        docType = this[AiDocumentsTable.docType],
        status = DocumentStatus.valueOf(this[AiDocumentsTable.status]),
        filePath = this[AiDocumentsTable.filePath],
        fileHash = this[AiDocumentsTable.fileHash],
        chunkCount = this[AiDocumentsTable.chunkCount],
        canonical = this[AiDocumentsTable.canonical],
        originalFilename = this[AiDocumentsTable.originalFilename],
        fileSize = this[AiDocumentsTable.fileSize],
        source = this[AiDocumentsTable.docSource],
        sourceUrl = this[AiDocumentsTable.sourceUrl],
        metadata = try { json.decodeFromString(this[AiDocumentsTable.metadata]) } catch (_: Exception) { emptyMap() },
    )

    private fun ResultRow.toChunk() = DocumentChunk(
        id = this[AiChunksTable.id],
        documentId = this[AiChunksTable.documentId],
        chunkIndex = this[AiChunksTable.chunkIndex],
        content = this[AiChunksTable.content],
        metadata = try { json.decodeFromString(this[AiChunksTable.metadata]) } catch (_: Exception) { emptyMap() },
    )
}

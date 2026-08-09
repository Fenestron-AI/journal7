package ru.journal7.ai.application

import ru.journal7.ai.domain.AiRepository
import ru.journal7.ai.domain.AiNotification
import java.io.File
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import io.github.oshai.kotlinlogging.KotlinLogging

private val logger = KotlinLogging.logger {}

/**
 * Watches data/legal-docs/current/ for new or changed documents.
 * On startup and on refresh trigger, scans the directory and registers
 * new/changed files with AiService.
 */
class DocumentWatcher(
    private val aiService: AiService,
    private val repository: AiRepository,
    private val watchDir: String,
) {
    private val scope = CoroutineScope(Dispatchers.IO)

    fun scan() {
        logger.info { "Scanning watch dir: $watchDir" }
        scope.launch {
            val dir = File(watchDir)
            if (!dir.exists()) dir.mkdirs()
            val files = dir.listFiles()?.filter { it.isFile } ?: emptyList()
            logger.info { "Found ${files.size} files" }
            files.forEach { file ->
                try {
                    val doc = aiService.registerFromFile(file)
                    logger.info { "Registered: ${doc.title} (${doc.id})" }
                } catch (e: Exception) {
                    logger.error(e) { "Failed to register ${file.name}" }
                }
            }
        }
    }

    fun registerManually(file: File) = scope.launch {
        try { aiService.registerFromFile(file) } catch (e: Exception) { }
    }
}

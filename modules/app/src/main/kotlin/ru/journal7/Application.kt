package ru.journal7

import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import ru.journal7.plugins.*

fun main() {
    val config = loadConfig()

    DatabaseFactory.init(config.db)

    embeddedServer(Netty, host = config.server.host, port = config.server.port) {
        configureSerialization()
        configureErrorHandling()
        configureCors(config.cors)
        configureMonitoring()
        configureRouting()
    }.start(wait = true)
}

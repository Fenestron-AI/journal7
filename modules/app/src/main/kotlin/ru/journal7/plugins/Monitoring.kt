package ru.journal7.plugins

import io.ktor.server.application.*

fun Application.configureMonitoring() {
    log.info("Application plugins initialized")
}

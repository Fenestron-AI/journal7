package ru.journal7.plugins

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.compression.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Application.configureRouting() {
    install(Compression) {
        gzip { priority = 1.0 }
        deflate { priority = 10.0 }
    }
}

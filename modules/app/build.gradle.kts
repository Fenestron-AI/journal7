plugins {
    alias(libs.plugins.ktor)
    application
}

kotlin {
    jvmToolchain(21)
}

application {
    mainClass.set("ru.journal7.ApplicationKt")
}

dependencies {
    implementation(project.libs.kotlin.stdlib)
    implementation(project.libs.kotlinx.coroutines.core)
    implementation(project.libs.kotlinx.serialization.json)
    implementation(project.libs.kotlin.logging)

    implementation(project(":core"))
    implementation(project(":auth"))
    implementation(project(":reference"))
    implementation(project(":contract"))
    implementation(project(":calculation"))
    implementation(project(":billing"))
    implementation(project(":reporting"))
    implementation(project(":integration"))
    implementation(project(":ai"))

    implementation(project.libs.ktor.server.core)
    implementation(project.libs.ktor.server.netty)
    implementation(project.libs.ktor.server.content.negotiation)
    implementation(project.libs.ktor.serialization.kotlinx.json)
    implementation(project.libs.ktor.server.auth)
    implementation(project.libs.ktor.server.auth.jwt)
    implementation(project.libs.ktor.server.status.pages)
    implementation(project.libs.ktor.server.cors)
    implementation(project.libs.ktor.server.call.logging)
    implementation(project.libs.ktor.server.compression)
    implementation(project.libs.ktor.server.openapi)
    implementation(project.libs.ktor.server.swagger)

    implementation(project.libs.exposed.core)
    implementation(project.libs.exposed.dao)
    implementation(project.libs.exposed.jdbc)
    implementation(project.libs.exposed.json)
    implementation(project.libs.exposed.kotlin.datetime)
    implementation(project.libs.hikari)
    implementation(project.libs.postgresql)
    implementation(project.libs.flyway.core)
    implementation(project.libs.flyway.database.postgresql)

    implementation(project.libs.koin.core)
    implementation(project.libs.koin.ktor3)
    implementation(project.libs.koin.logger.slf4j)

    implementation(project.libs.hoplite.core)
    implementation(project.libs.hoplite.yaml)

    implementation(project.libs.logback.classic)

    implementation(project.libs.jedis)
    implementation(project.libs.minio)

    testImplementation(project.libs.ktor.server.test.host)
    testImplementation(project.libs.testcontainers.postgresql)
    testImplementation(project.libs.kotest.extensions.testcontainers)
    testImplementation(project.libs.kotest.runner.junit5)
    testImplementation(project.libs.kotest.assertions.core)
    testImplementation(project.libs.mockk)
}

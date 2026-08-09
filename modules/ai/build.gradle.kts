plugins {
    id("org.jetbrains.kotlin.jvm")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    jvmToolchain(21)
}

dependencies {
    implementation(project.libs.kotlin.stdlib)
    implementation(project.libs.kotlinx.coroutines.core)
    implementation(project.libs.kotlinx.serialization.json)
    implementation(project.libs.kotlin.logging)

    implementation(project(":core"))

    implementation(project.libs.exposed.core)
    implementation(project.libs.exposed.dao)
    implementation(project.libs.exposed.jdbc)
    implementation(project.libs.ktor.server.core)
    implementation(project.libs.ktor.client.core)
    implementation(project.libs.ktor.client.cio)
    implementation(project.libs.ktor.client.content.negotiation)
    implementation(project.libs.ktor.serialization.kotlinx.json)
    implementation(project.libs.koin.ktor3)

    testImplementation(project.libs.kotest.runner.junit5)
    testImplementation(project.libs.kotest.assertions.core)
    testImplementation(project.libs.mockk)
}

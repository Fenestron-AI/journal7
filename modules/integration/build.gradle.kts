kotlin {
    jvmToolchain(21)
}

dependencies {
    implementation(project.libs.kotlin.stdlib)
    implementation(project.libs.kotlinx.coroutines.core)
    implementation(project.libs.kotlinx.serialization.json)
    implementation(project.libs.kotlin.logging)

    implementation(project(":core"))
    implementation(project(":reference"))

    implementation(project.libs.ktor.client.core)
    implementation(project.libs.ktor.client.cio)
    implementation(project.libs.ktor.client.content.negotiation)
    implementation(project.libs.poi.ooxml)
    implementation(project.libs.koin.ktor)

    testImplementation(project.libs.kotest.runner.junit5)
    testImplementation(project.libs.kotest.assertions.core)
    testImplementation(project.libs.mockk)
}

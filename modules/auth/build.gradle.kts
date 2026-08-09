kotlin {
    jvmToolchain(21)
}

dependencies {
    implementation(project.libs.kotlin.stdlib)
    implementation(project.libs.kotlinx.coroutines.core)
    implementation(project.libs.kotlinx.serialization.json)
    implementation(project.libs.kotlin.logging)

    implementation(project(":core"))

    implementation(project.libs.ktor.server.auth)
    implementation(project.libs.ktor.server.auth.jwt)
    implementation(project.libs.jwt)
    implementation(project.libs.bcrypt)
    implementation(project.libs.koin.ktor)

    testImplementation(project.libs.kotest.runner.junit5)
    testImplementation(project.libs.kotest.assertions.core)
    testImplementation(project.libs.mockk)
}

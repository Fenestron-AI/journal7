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
    implementation(project.libs.exposed.json)
    implementation(project.libs.exposed.kotlin.datetime)
    implementation(project.libs.koin.ktor)

    testImplementation(project.libs.kotest.runner.junit5)
    testImplementation(project.libs.kotest.assertions.core)
    testImplementation(project.libs.mockk)
}

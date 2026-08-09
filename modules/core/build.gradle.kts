kotlin {
    jvmToolchain(21)
}

dependencies {
    implementation(project.libs.kotlin.stdlib)
    implementation(project.libs.kotlin.reflect)
    implementation(project.libs.kotlinx.coroutines.core)
    implementation(project.libs.kotlinx.serialization.json)
    implementation(project.libs.kotlin.logging)
    implementation(project.libs.koin.core)

    testImplementation(project.libs.kotest.runner.junit5)
    testImplementation(project.libs.kotest.assertions.core)
    testImplementation(project.libs.mockk)
}

rootProject.name = "journal7"

include(
    ":core",
    ":auth",
    ":reference",
    ":contract",
    ":calculation",
    ":billing",
    ":reporting",
    ":integration",
    ":ai",
    ":app"
)

project(":core").projectDir = file("modules/core")
project(":auth").projectDir = file("modules/auth")
project(":reference").projectDir = file("modules/reference")
project(":contract").projectDir = file("modules/contract")
project(":calculation").projectDir = file("modules/calculation")
project(":billing").projectDir = file("modules/billing")
project(":reporting").projectDir = file("modules/reporting")
project(":integration").projectDir = file("modules/integration")
project(":ai").projectDir = file("modules/ai")
project(":app").projectDir = file("modules/app")

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}

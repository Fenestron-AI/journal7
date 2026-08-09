package ru.journal7

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.koin.dsl.module
import org.koin.ktor.plugin.Koin
import ru.journal7.ai.api.aiRoutes
import ru.journal7.ai.application.AiService
import ru.journal7.ai.application.DocumentWatcher
import ru.journal7.ai.domain.AiRepository
import ru.journal7.ai.infrastructure.AiWorkerClient
import ru.journal7.ai.infrastructure.PostgresAiRepository
import ru.journal7.auth.api.authRoutes
import ru.journal7.auth.api.configureAuthPlugin
import ru.journal7.auth.application.AuthService
import ru.journal7.auth.domain.SecurityConfig
import ru.journal7.auth.domain.UserRepository
import ru.journal7.auth.infrastructure.PostgresUserRepository
import ru.journal7.billing.api.billingRoutes
import ru.journal7.billing.application.BillingService
import ru.journal7.billing.domain.AcceptanceActRepository
import ru.journal7.billing.domain.InvoiceRepository
import ru.journal7.billing.infrastructure.PostgresAcceptanceActRepository
import ru.journal7.billing.infrastructure.PostgresInvoiceRepository
import ru.journal7.calculation.api.calculationRoutes
import ru.journal7.calculation.application.CalculationService
import ru.journal7.calculation.domain.CalculationRepository
import ru.journal7.calculation.infrastructure.PostgresCalculationRepository
import ru.journal7.contract.api.contractRoutes
import ru.journal7.contract.application.ContractService
import ru.journal7.contract.domain.SaleContractRepository
import ru.journal7.contract.infrastructure.PostgresSaleContractRepository
import ru.journal7.integration.api.integrationRoutes
import ru.journal7.integration.application.ImportService
import ru.journal7.plugins.*
import ru.journal7.reference.api.powerProfileRoutes
import ru.journal7.reference.api.referenceRoutes
import ru.journal7.reference.application.CounterpartyService
import ru.journal7.reference.application.PowerProfileService
import ru.journal7.reference.domain.CounterpartyRepository
import ru.journal7.reference.domain.PowerProfileRepository
import ru.journal7.reference.infrastructure.PostgresCounterpartyRepository
import ru.journal7.reference.infrastructure.PostgresPowerProfileRepository
import ru.journal7.reporting.api.reportingRoutes
import ru.journal7.reporting.application.ExcelReportService

fun main() {
    val config = loadConfig()

    DatabaseFactory.init(config.db)

    embeddedServer(Netty, host = config.server.host, port = config.server.port) {
        configureKoin(config)
        configureSerialization()
        configureErrorHandling()
        configureCors(config.cors)
        configureMonitoring()
        configureRouting()
        configureAuthPlugin()

        routing {
            get("/api/health") {
                call.respondText(
                    """{"status":"ok","version":"0.1.0"}""",
                    ContentType.Application.Json
                )
            }
            authRoutes()
            referenceRoutes()
            powerProfileRoutes()
            contractRoutes()
            calculationRoutes()
            billingRoutes()
            reportingRoutes()
            integrationRoutes()
            aiRoutes()
        }
    }.start(wait = true)
}

private fun Application.configureKoin(config: AppConfig) {
    val appModule = module {
        single { config }
        single { config.db }
        single { config.redis }
        single { config.minio }

        single {
            SecurityConfig(
                jwtSecret = config.jwt.secret,
                jwtIssuer = config.jwt.issuer,
                accessTokenTtlMinutes = config.jwt.accessTtlMinutes,
                refreshTokenTtlDays = config.jwt.refreshTtlDays
            )
        }

        single<UserRepository> { PostgresUserRepository() }
        single { AuthService(get(), get()) }

        single<CounterpartyRepository> { PostgresCounterpartyRepository() }
        single { CounterpartyService(get()) }
        single<PowerProfileRepository> { PostgresPowerProfileRepository() }
        single { PowerProfileService(get()) }

        single<SaleContractRepository> { PostgresSaleContractRepository() }
        single { ContractService(get(), get()) }

        single<CalculationRepository> { PostgresCalculationRepository() }
        single { CalculationService(get(), get(), get()) }

        single<InvoiceRepository> { PostgresInvoiceRepository() }
        single<AcceptanceActRepository> { PostgresAcceptanceActRepository() }
        single { BillingService(get(), get(), get(), get()) }

        single { ExcelReportService() }
        single { ImportService(get(), get()) }

        // AI
        single<AiRepository> { PostgresAiRepository() }
        single<AiWorkerClient> { AiWorkerClient(config.ai.workerUrl) }
        single<AiService> { AiService(get(), get()) }
        single<DocumentWatcher> { DocumentWatcher(get(), get(), config.ai.watchDir) }
    }

    install(Koin) {
        modules(appModule)
    }
}

package ru.journal7

import com.sksamuel.hoplite.ConfigLoaderBuilder
import com.sksamuel.hoplite.addEnvironmentSource
import com.sksamuel.hoplite.addResourceSource
import com.sksamuel.hoplite.fp.Validated

data class AppConfig(
    val server: ServerConfig,
    val db: DatabaseConfig,
    val redis: RedisConfig,
    val minio: MinioConfig,
    val jwt: JwtConfig,
    val cors: CorsConfig,
    val ai: AiConfig
)

data class ServerConfig(
    val host: String = "0.0.0.0",
    val port: Int = 8080
)

data class DatabaseConfig(
    val host: String = "localhost",
    val port: Int = 5432,
    val name: String = "journal7",
    val user: String = "journal7",
    val password: String = "journal7_dev",
    val poolSize: Int = 20
) {
    val jdbcUrl: String get() = "jdbc:postgresql://$host:$port/$name"
}

data class RedisConfig(
    val host: String = "localhost",
    val port: Int = 6379,
    val password: String? = null
)

data class MinioConfig(
    val endpoint: String = "http://localhost:9000",
    val accessKey: String = "minioadmin",
    val secretKey: String = "minioadmin",
    val bucket: String = "journal7"
)

data class JwtConfig(
    val secret: String,
    val issuer: String = "journal7.ru",
    val accessTtlMinutes: Long = 60,
    val refreshTtlDays: Long = 30
)

data class CorsConfig(
    val origins: String = "http://localhost:5173"
) {
    val allowedOrigins: List<String> get() = origins.split(",").map { it.trim() }
}

data class AiConfig(
    val workerUrl: String = "http://localhost:8000",
    val watchDir: String = "data/legal-docs/current"
)

fun loadConfig(env: String = "dev"): AppConfig {
    val loader = ConfigLoaderBuilder.default()
        .addResourceSource("/application-$env.yaml")
        .addEnvironmentSource()
        .build()

    return when (val result = loader.loadConfig<AppConfig>()) {
        is Validated.Valid -> result.value
        is Validated.Invalid -> throw IllegalStateException(
            "Config loading failed: ${result}"
        )
    }
}

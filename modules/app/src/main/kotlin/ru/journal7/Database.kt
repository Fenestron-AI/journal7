package ru.journal7

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.sql.Database

object DatabaseFactory {

    fun init(config: DatabaseConfig) {
        val hikariConfig = HikariConfig().apply {
            jdbcUrl = config.jdbcUrl
            username = config.user
            password = config.password
            maximumPoolSize = config.poolSize
            minimumIdle = 2
            idleTimeout = 30000
            connectionTimeout = 10000
            maxLifetime = 300000
            isAutoCommit = false
            transactionIsolation = "TRANSACTION_READ_COMMITTED"
        }

        val dataSource = HikariDataSource(hikariConfig)
        Database.connect(dataSource)

        runMigrations(dataSource)
    }

    private fun runMigrations(dataSource: HikariDataSource) {
        Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .validateMigrationNaming(true)
            .load()
            .migrate()
    }
}

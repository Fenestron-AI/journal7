package ru.journal7.calculation.infrastructure

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import ru.journal7.calculation.domain.*
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

object SaleCalculationsTable : Table("document.sale_calculations") {
    val id = uuid("id")
    val contractId = uuid("contract_id")
    val periodFrom = varchar("period_from", 10)
    val periodTo = varchar("period_to", 10)
    val priceCategory = varchar("price_category", 16)
    val status = varchar("status", 32)
    val totalVolume = decimal("total_volume", 18, 6)
    val totalCost = decimal("total_cost", 18, 2)
    val resultData = text("result_data")
    val createdAt = long("created_at")
    val updatedAt = long("updated_at")

    override val primaryKey = PrimaryKey(id)
}

class PostgresCalculationRepository : CalculationRepository {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; prettyPrint = false }

    override suspend fun findById(id: UUID): CalculationResult? = transaction {
        SaleCalculationsTable.selectAll().where { SaleCalculationsTable.id eq id }
            .singleOrNull()?.toResult()
    }

    override suspend fun findByContract(contractId: UUID): List<CalculationResult> = transaction {
        SaleCalculationsTable.selectAll()
            .where { SaleCalculationsTable.contractId eq contractId }
            .orderBy(SaleCalculationsTable.createdAt to SortOrder.DESC)
            .map { it.toResult() }
    }

    override suspend fun save(result: CalculationResult): CalculationResult = transaction {
        val dataJson = json.encodeToString(CalcData(result.hourlyResults, result.zoneResults))

        SaleCalculationsTable.insert {
            it[id] = result.id
            it[contractId] = result.contractId
            it[periodFrom] = result.periodFrom.toString()
            it[periodTo] = result.periodTo.toString()
            it[priceCategory] = result.priceCategory.name
            it[status] = result.status.name
            it[totalVolume] = result.totalVolume.toBigDecimal()
            it[totalCost] = result.totalCost.toBigDecimal()
            it[resultData] = dataJson
            it[createdAt] = Instant.now().toEpochMilli()
            it[updatedAt] = Instant.now().toEpochMilli()
        }
        result
    }

    override suspend fun delete(id: UUID): Boolean = transaction {
        SaleCalculationsTable.deleteWhere { SaleCalculationsTable.id eq id } > 0
    }

    private fun ResultRow.toResult(): CalculationResult {
        val data = try {
            json.decodeFromString<CalcData>(this[SaleCalculationsTable.resultData])
        } catch (_: Exception) {
            CalcData(emptyList(), emptyMap())
        }

        return CalculationResult(
            id = this[SaleCalculationsTable.id],
            contractId = this[SaleCalculationsTable.contractId],
            priceCategory = PriceCategory.valueOf(this[SaleCalculationsTable.priceCategory]),
            status = CalculationStatus.valueOf(this[SaleCalculationsTable.status]),
            periodFrom = LocalDate.parse(this[SaleCalculationsTable.periodFrom]),
            periodTo = LocalDate.parse(this[SaleCalculationsTable.periodTo]),
            totalVolume = this[SaleCalculationsTable.totalVolume].toDouble(),
            totalCost = this[SaleCalculationsTable.totalCost].toDouble(),
            hourlyResults = data.hourly,
            zoneResults = data.zones
        )
    }

    @kotlinx.serialization.Serializable
    private data class CalcData(
        val hourly: List<HourlyResult>,
        val zones: Map<String, ZoneResult>
    )
}

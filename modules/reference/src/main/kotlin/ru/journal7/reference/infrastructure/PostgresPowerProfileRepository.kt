package ru.journal7.reference.infrastructure

import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greaterEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.lessEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.like
import org.jetbrains.exposed.sql.transactions.transaction
import ru.journal7.reference.domain.*
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

object PowerProfilesTable : Table("directory.power_profiles") {
    val id = uuid("id")
    val code = varchar("code", 64).uniqueIndex()
    val name = varchar("name", 512)
    val profileType = varchar("type", 32)
    val regionId = uuid("region_id").nullable()
    val unit = varchar("unit", 16).default("MW")
    val minValue = decimal("min_value", 18, 6).nullable()
    val maxValue = decimal("max_value", 18, 6).nullable()
    val avgValue = decimal("avg_value", 18, 6).nullable()
    val valueCount = integer("value_count").default(0)
    val createdAt = long("created_at")
    val updatedAt = long("updated_at")

    override val primaryKey = PrimaryKey(id)
}

object PowerProfileValuesTable : Table("directory.power_profile_values") {
    val id = long("id").autoIncrement()
    val profileId = uuid("profile_id")
    val periodDate = varchar("period_date", 10)
    val hour = short("hour")
    val value = decimal("value", 18, 6)
}

class PostgresPowerProfileRepository : PowerProfileRepository {

    override suspend fun findById(id: UUID): PowerProfile? = transaction {
        PowerProfilesTable.selectAll().where { PowerProfilesTable.id eq id }
            .singleOrNull()?.toProfile()
    }

    override suspend fun findByCode(code: String): PowerProfile? = transaction {
        PowerProfilesTable.selectAll().where { PowerProfilesTable.code eq code }
            .singleOrNull()?.toProfile()
    }

    override suspend fun search(query: String, type: PowerProfileType?, page: Int, size: Int): List<PowerProfile> = transaction {
        var q: Query = PowerProfilesTable.selectAll()
        if (query.isNotBlank()) {
            q = q.where { (PowerProfilesTable.name like "%$query%") or (PowerProfilesTable.code like "%$query%") }
        }
        if (type != null) {
            q = q.where { PowerProfilesTable.profileType eq type.name }
        }
        q.orderBy(PowerProfilesTable.name)
            .limit(size).offset(((page - 1) * size).toLong())
            .map { it.toProfile() }
    }

    override suspend fun count(query: String, type: PowerProfileType?): Long = transaction {
        var q: Query = PowerProfilesTable.selectAll()
        if (query.isNotBlank()) {
            q = q.where { (PowerProfilesTable.name like "%$query%") or (PowerProfilesTable.code like "%$query%") }
        }
        if (type != null) {
            q = q.where { PowerProfilesTable.profileType eq type.name }
        }
        q.count()
    }

    override suspend fun create(profile: PowerProfile): PowerProfile = transaction {
        PowerProfilesTable.insert {
            it[id] = profile.id
            it[code] = profile.code
            it[name] = profile.name
            it[profileType] = profile.type.name
            it[regionId] = profile.regionId
            it[unit] = profile.unit
            it[minValue] = profile.minValue?.let { v -> BigDecimal.valueOf(v) }
            it[maxValue] = profile.maxValue?.let { v -> BigDecimal.valueOf(v) }
            it[avgValue] = profile.avgValue?.let { v -> BigDecimal.valueOf(v) }
            it[valueCount] = profile.valueCount
            it[createdAt] = Instant.now().toEpochMilli()
            it[updatedAt] = Instant.now().toEpochMilli()
        }
        profile
    }

    override suspend fun update(profile: PowerProfile): PowerProfile = transaction {
        PowerProfilesTable.update({ PowerProfilesTable.id eq profile.id }) {
            it[code] = profile.code
            it[name] = profile.name
            it[profileType] = profile.type.name
            it[regionId] = profile.regionId
            it[unit] = profile.unit
            it[updatedAt] = Instant.now().toEpochMilli()
        }
        profile
    }

    override suspend fun delete(id: UUID): Boolean = transaction {
        PowerProfileValuesTable.deleteWhere { PowerProfileValuesTable.profileId eq id }
        PowerProfilesTable.deleteWhere { PowerProfilesTable.id eq id }
    } > 0

    override suspend fun getValues(profileId: UUID, from: LocalDate, to: LocalDate): List<PowerProfileValue> = transaction {
        val rows = PowerProfileValuesTable.selectAll()
            .where {
                (PowerProfileValuesTable.profileId eq profileId) and
                    (PowerProfileValuesTable.periodDate greaterEq from.toString()) and
                    (PowerProfileValuesTable.periodDate lessEq to.toString())
            }
            .orderBy(PowerProfileValuesTable.periodDate to SortOrder.ASC, PowerProfileValuesTable.hour to SortOrder.ASC)

        rows.mapNotNull { row: ResultRow ->
            val dateStr = row[PowerProfileValuesTable.periodDate]
            val date = try { LocalDate.parse(dateStr) } catch (_: Exception) { null } ?: return@mapNotNull null
            PowerProfileValue(
                profileId = row[PowerProfileValuesTable.profileId],
                periodDate = date,
                hour = row[PowerProfileValuesTable.hour].toInt(),
                value = row[PowerProfileValuesTable.value].toDouble()
            )
        }
    }

    override suspend fun upsertValues(profileId: UUID, values: List<PowerProfileValue>): Int = transaction {
        var count = 0
        values.forEach { v ->
            val dateStr = v.periodDate.toString()
            val hourVal: Short = v.hour.toShort()

            val existing = PowerProfileValuesTable.selectAll().where {
                (PowerProfileValuesTable.profileId eq profileId) and
                    (PowerProfileValuesTable.periodDate eq dateStr) and
                    (PowerProfileValuesTable.hour eq hourVal)
            }.singleOrNull()

            if (existing != null) {
                PowerProfileValuesTable.update({
                    (PowerProfileValuesTable.profileId eq profileId) and
                        (PowerProfileValuesTable.periodDate eq dateStr) and
                        (PowerProfileValuesTable.hour eq hourVal)
                }) {
                    it[value] = BigDecimal.valueOf(v.value)
                }
            } else {
                PowerProfileValuesTable.insert {
                    it[PowerProfileValuesTable.profileId] = profileId
                    it[periodDate] = dateStr
                    it[hour] = hourVal
                    it[value] = BigDecimal.valueOf(v.value)
                }
            }
            count++
        }
        recalcStats(profileId)
        count
    }

    override suspend fun deleteValues(profileId: UUID, from: LocalDate, to: LocalDate): Int = transaction {
        val deleted = PowerProfileValuesTable.deleteWhere {
            (PowerProfileValuesTable.profileId eq profileId) and
                (PowerProfileValuesTable.periodDate greaterEq from.toString()) and
                (PowerProfileValuesTable.periodDate lessEq to.toString())
        }
        recalcStats(profileId)
        deleted
    }

    override suspend fun getHourlyStats(profileId: UUID, from: LocalDate, to: LocalDate): List<PowerProfileHourlyStats> = transaction {
        PowerProfileValuesTable
            .select(
                PowerProfileValuesTable.hour,
                PowerProfileValuesTable.value.avg(),
                PowerProfileValuesTable.value.min(),
                PowerProfileValuesTable.value.max()
            )
            .where {
                (PowerProfileValuesTable.profileId eq profileId) and
                    (PowerProfileValuesTable.periodDate greaterEq from.toString()) and
                    (PowerProfileValuesTable.periodDate lessEq to.toString())
            }
            .groupBy(PowerProfileValuesTable.hour)
            .orderBy(PowerProfileValuesTable.hour)
            .map { row ->
                val avgVal: BigDecimal? = row[PowerProfileValuesTable.value.avg()]
                val minVal: BigDecimal? = row[PowerProfileValuesTable.value.min()]
                val maxVal: BigDecimal? = row[PowerProfileValuesTable.value.max()]
                PowerProfileHourlyStats(
                    hour = row[PowerProfileValuesTable.hour].toInt(),
                    avg = avgVal?.toDouble() ?: 0.0,
                    min = minVal?.toDouble() ?: 0.0,
                    max = maxVal?.toDouble() ?: 0.0,
                    stddev = 0.0
                )
            }
    }

    private fun recalcStats(profileId: UUID) {
        val now = Instant.now().toEpochMilli()
        val sub = PowerProfileValuesTable
            .select(
                PowerProfileValuesTable.value.min(),
                PowerProfileValuesTable.value.max(),
                PowerProfileValuesTable.value.avg(),
                PowerProfileValuesTable.value.count()
            )
            .where { PowerProfileValuesTable.profileId eq profileId }
            .singleOrNull()

        PowerProfilesTable.update({ PowerProfilesTable.id eq profileId }) {
            it[minValue] = sub?.let { s -> (s[PowerProfileValuesTable.value.min()] as? BigDecimal) }
            it[maxValue] = sub?.let { s -> (s[PowerProfileValuesTable.value.max()] as? BigDecimal) }
            it[avgValue] = sub?.let { s -> (s[PowerProfileValuesTable.value.avg()] as? BigDecimal) }
            it[valueCount] = sub?.let { s -> (s[PowerProfileValuesTable.value.count()] as? Long)?.toInt() } ?: 0
            it[updatedAt] = now
        }
    }

    private fun ResultRow.toProfile(): PowerProfile = PowerProfile(
        id = this[PowerProfilesTable.id],
        code = this[PowerProfilesTable.code],
        name = this[PowerProfilesTable.name],
        type = PowerProfileType.valueOf(this[PowerProfilesTable.profileType]),
        regionId = this[PowerProfilesTable.regionId],
        unit = this[PowerProfilesTable.unit],
        minValue = this[PowerProfilesTable.minValue]?.toDouble(),
        maxValue = this[PowerProfilesTable.maxValue]?.toDouble(),
        avgValue = this[PowerProfilesTable.avgValue]?.toDouble(),
        valueCount = this[PowerProfilesTable.valueCount],
    )
}

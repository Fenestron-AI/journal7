package ru.journal7.contract.infrastructure

import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.like
import org.jetbrains.exposed.sql.transactions.transaction
import ru.journal7.contract.domain.*
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

object SaleContractsTable : Table("document.sale_contracts") {
    val id = uuid("id")
    val number = varchar("number", 128)
    val counterpartyId = uuid("counterparty_id")
    val dateFrom = varchar("date_from", 10)
    val dateTo = varchar("date_to", 10).nullable()
    val type = varchar("type", 32)
    val priceCategory = varchar("price_category", 16)
    val calculationGroupId = uuid("calculation_group_id").nullable()
    val confirmedBy = uuid("confirmed_by").nullable()
    val confirmed = bool("confirmed").default(false)
    val confirmedAt = long("confirmed_at").nullable()
    val metadata = text("metadata").default("{}")
    val deleted = bool("deleted").default(false)
    val createdAt = long("created_at")
    val updatedAt = long("updated_at")

    override val primaryKey = PrimaryKey(id)
}

object AccountingObjectsTable : Table("document.accounting_objects") {
    val id = uuid("id")
    val contractId = uuid("contract_id")
    val name = varchar("name", 512)
    val code = varchar("code", 128).nullable()
    val deleted = bool("deleted").default(false)
    val createdAt = long("created_at")
    val updatedAt = long("updated_at")

    override val primaryKey = PrimaryKey(id)
}

object DeliveryPointsTable : Table("document.delivery_points") {
    val id = uuid("id")
    val objectId = uuid("object_id")
    val contractId = uuid("contract_id")
    val name = varchar("name", 512)
    val code = varchar("code", 128).nullable()
    val meteringPoints = text("metering_points").default("[]")
    val deleted = bool("deleted").default(false)
    val createdAt = long("created_at")
    val updatedAt = long("updated_at")

    override val primaryKey = PrimaryKey(id)
}

class PostgresSaleContractRepository : SaleContractRepository {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    // --- Contracts ---

    override suspend fun findById(id: UUID): SaleContract? = transaction {
        SaleContractsTable.selectAll().where { (SaleContractsTable.id eq id) and (SaleContractsTable.deleted eq false) }
            .singleOrNull()?.toContract()
    }

    override suspend fun search(query: String, counterpartyId: UUID?, page: Int, size: Int): List<SaleContract> = transaction {
        var q: Query = SaleContractsTable.selectAll().where { SaleContractsTable.deleted eq false }
        if (query.isNotBlank()) {
            q = q.where { SaleContractsTable.number like "%$query%" }
        }
        if (counterpartyId != null) {
            q = q.where { SaleContractsTable.counterpartyId eq counterpartyId }
        }
        q.orderBy(SaleContractsTable.createdAt to SortOrder.DESC)
            .limit(size).offset(((page - 1) * size).toLong())
            .map { it.toContract() }
    }

    override suspend fun count(query: String, counterpartyId: UUID?): Long = transaction {
        var q: Query = SaleContractsTable.selectAll().where { SaleContractsTable.deleted eq false }
        if (query.isNotBlank()) q = q.where { SaleContractsTable.number like "%$query%" }
        if (counterpartyId != null) q = q.where { SaleContractsTable.counterpartyId eq counterpartyId }
        q.count()
    }

    override suspend fun create(contract: SaleContract): SaleContract = transaction {
        SaleContractsTable.insert {
            it[id] = contract.id
            it[number] = contract.number
            it[counterpartyId] = contract.counterpartyId
            it[dateFrom] = contract.dateFrom.toString()
            it[dateTo] = contract.dateTo?.toString()
            it[type] = contract.type.name
            it[priceCategory] = contract.priceCategory.name
            it[calculationGroupId] = contract.calculationGroupId
            it[confirmedBy] = contract.confirmedById
            it[confirmed] = contract.confirmed
            it[confirmedAt] = contract.confirmedAt?.toEpochMilli()
            it[metadata] = json.encodeToString(contract.metadata)
            it[createdAt] = Instant.now().toEpochMilli()
            it[updatedAt] = Instant.now().toEpochMilli()
        }
        contract
    }

    override suspend fun update(contract: SaleContract): SaleContract = transaction {
        SaleContractsTable.update({ SaleContractsTable.id eq contract.id }) {
            it[number] = contract.number
            it[counterpartyId] = contract.counterpartyId
            it[dateFrom] = contract.dateFrom.toString()
            it[dateTo] = contract.dateTo?.toString()
            it[type] = contract.type.name
            it[priceCategory] = contract.priceCategory.name
            it[calculationGroupId] = contract.calculationGroupId
            it[metadata] = json.encodeToString(contract.metadata)
            it[updatedAt] = Instant.now().toEpochMilli()
        }
        contract
    }

    override suspend fun softDelete(id: UUID): Boolean = transaction {
        SaleContractsTable.update({ SaleContractsTable.id eq id }) {
            it[deleted] = true
            it[updatedAt] = Instant.now().toEpochMilli()
        } > 0
    }

    // --- Objects ---

    override suspend fun findObjectsByContract(contractId: UUID): List<AccountingObject> = transaction {
        AccountingObjectsTable.selectAll()
            .where { (AccountingObjectsTable.contractId eq contractId) and (AccountingObjectsTable.deleted eq false) }
            .orderBy(AccountingObjectsTable.createdAt to SortOrder.ASC)
            .map { it.toObject() }
    }

    override suspend fun findObjectById(objectId: UUID): AccountingObject? = transaction {
        AccountingObjectsTable.selectAll()
            .where { (AccountingObjectsTable.id eq objectId) and (AccountingObjectsTable.deleted eq false) }
            .singleOrNull()?.toObject()
    }

    override suspend fun createObject(obj: AccountingObject): AccountingObject = transaction {
        AccountingObjectsTable.insert {
            it[id] = obj.id
            it[contractId] = obj.contractId
            it[name] = obj.name
            it[code] = obj.code
            it[createdAt] = Instant.now().toEpochMilli()
            it[updatedAt] = Instant.now().toEpochMilli()
        }
        obj
    }

    override suspend fun updateObject(obj: AccountingObject): AccountingObject = transaction {
        AccountingObjectsTable.update({ AccountingObjectsTable.id eq obj.id }) {
            it[name] = obj.name
            it[code] = obj.code
            it[updatedAt] = Instant.now().toEpochMilli()
        }
        obj
    }

    override suspend fun softDeleteObject(objectId: UUID): Boolean = transaction {
        AccountingObjectsTable.update({ AccountingObjectsTable.id eq objectId }) {
            it[deleted] = true
            it[updatedAt] = Instant.now().toEpochMilli()
        } > 0
    }

    // --- Delivery points ---

    override suspend fun findDeliveryPointsByObject(objectId: UUID): List<DeliveryPoint> = transaction {
        DeliveryPointsTable.selectAll()
            .where { (DeliveryPointsTable.objectId eq objectId) and (DeliveryPointsTable.deleted eq false) }
            .orderBy(DeliveryPointsTable.createdAt to SortOrder.ASC)
            .map { it.toDeliveryPoint() }
    }

    override suspend fun findDeliveryPointsByContract(contractId: UUID): List<DeliveryPoint> = transaction {
        DeliveryPointsTable.selectAll()
            .where { (DeliveryPointsTable.contractId eq contractId) and (DeliveryPointsTable.deleted eq false) }
            .orderBy(DeliveryPointsTable.createdAt to SortOrder.ASC)
            .map { it.toDeliveryPoint() }
    }

    override suspend fun findDeliveryPointById(pointId: UUID): DeliveryPoint? = transaction {
        DeliveryPointsTable.selectAll()
            .where { (DeliveryPointsTable.id eq pointId) and (DeliveryPointsTable.deleted eq false) }
            .singleOrNull()?.toDeliveryPoint()
    }

    override suspend fun createDeliveryPoint(point: DeliveryPoint): DeliveryPoint = transaction {
        DeliveryPointsTable.insert {
            it[id] = point.id
            it[objectId] = point.objectId
            it[contractId] = point.contractId
            it[name] = point.name
            it[code] = point.code
            it[meteringPoints] = json.encodeToString(point.meteringPoints)
            it[createdAt] = Instant.now().toEpochMilli()
            it[updatedAt] = Instant.now().toEpochMilli()
        }
        point
    }

    override suspend fun updateDeliveryPoint(point: DeliveryPoint): DeliveryPoint = transaction {
        DeliveryPointsTable.update({ DeliveryPointsTable.id eq point.id }) {
            it[name] = point.name
            it[code] = point.code
            it[meteringPoints] = json.encodeToString(point.meteringPoints)
            it[updatedAt] = Instant.now().toEpochMilli()
        }
        point
    }

    override suspend fun softDeleteDeliveryPoint(pointId: UUID): Boolean = transaction {
        DeliveryPointsTable.update({ DeliveryPointsTable.id eq pointId }) {
            it[deleted] = true
            it[updatedAt] = Instant.now().toEpochMilli()
        } > 0
    }

    // --- Mappers ---

    private fun ResultRow.toContract(): SaleContract = SaleContract(
        id = this[SaleContractsTable.id],
        number = this[SaleContractsTable.number],
        counterpartyId = this[SaleContractsTable.counterpartyId],
        dateFrom = LocalDate.parse(this[SaleContractsTable.dateFrom]),
        dateTo = this[SaleContractsTable.dateTo]?.let { LocalDate.parse(it) },
        type = ContractType.valueOf(this[SaleContractsTable.type]),
        priceCategory = PriceCategory.valueOf(this[SaleContractsTable.priceCategory]),
        calculationGroupId = this[SaleContractsTable.calculationGroupId],
        confirmedById = this[SaleContractsTable.confirmedBy],
        confirmed = this[SaleContractsTable.confirmed],
        confirmedAt = this[SaleContractsTable.confirmedAt]?.let { Instant.ofEpochMilli(it) },
        metadata = try { json.decodeFromString<Map<String, String>>(this[SaleContractsTable.metadata]) } catch (_: Exception) { emptyMap() }
    )

    private fun ResultRow.toObject(): AccountingObject = AccountingObject(
        id = this[AccountingObjectsTable.id],
        contractId = this[AccountingObjectsTable.contractId],
        name = this[AccountingObjectsTable.name],
        code = this[AccountingObjectsTable.code],
        deleted = this[AccountingObjectsTable.deleted]
    )

    private fun ResultRow.toDeliveryPoint(): DeliveryPoint = DeliveryPoint(
        id = this[DeliveryPointsTable.id],
        objectId = this[DeliveryPointsTable.objectId],
        contractId = this[DeliveryPointsTable.contractId],
        name = this[DeliveryPointsTable.name],
        code = this[DeliveryPointsTable.code],
        meteringPoints = try { json.decodeFromString<List<MeteringPoint>>(this[DeliveryPointsTable.meteringPoints]) } catch (_: Exception) { emptyList() },
        deleted = this[DeliveryPointsTable.deleted]
    )
}

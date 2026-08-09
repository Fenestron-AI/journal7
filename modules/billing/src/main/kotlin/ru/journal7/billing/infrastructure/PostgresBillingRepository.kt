package ru.journal7.billing.infrastructure

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import ru.journal7.billing.domain.*
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

object InvoicesTable : Table("document.sale_invoices") {
    val id = uuid("id")
    val contractId = uuid("contract_id")
    val calculationId = uuid("calculation_id").nullable()
    val number = varchar("number", 128)
    val date = varchar("date", 10)
    val type = varchar("type", 32)
    val items = text("items")
    val totalAmount = decimal("total_amount", 18, 2)
    val totalVat = decimal("total_vat", 18, 2)
    val totalWithVat = decimal("total_with_vat", 18, 2)
    val status = varchar("status", 32)
    val createdBy = uuid("created_by").nullable()
    val createdAt = long("created_at")
    val updatedAt = long("updated_at")
    override val primaryKey = PrimaryKey(id)
}

object AcceptanceActsTable : Table("document.acceptance_acts") {
    val id = uuid("id")
    val contractId = uuid("contract_id")
    val calculationId = uuid("calculation_id").nullable()
    val number = varchar("number", 128)
    val date = varchar("date", 10)
    val periodFrom = varchar("period_from", 10)
    val periodTo = varchar("period_to", 10)
    val volume = decimal("volume", 18, 6)
    val cost = decimal("cost", 18, 2)
    val status = varchar("status", 32)
    val createdBy = uuid("created_by").nullable()
    val createdAt = long("created_at")
    val updatedAt = long("updated_at")
    override val primaryKey = PrimaryKey(id)
}

class PostgresInvoiceRepository : InvoiceRepository {
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun findById(id: UUID): Invoice? = transaction {
        InvoicesTable.selectAll().where { InvoicesTable.id eq id }.singleOrNull()?.toInvoice()
    }

    override suspend fun findByContract(contractId: UUID): List<Invoice> = transaction {
        InvoicesTable.selectAll().where { InvoicesTable.contractId eq contractId }
            .orderBy(InvoicesTable.createdAt to SortOrder.DESC).map { it.toInvoice() }
    }

    override suspend fun findByNumber(number: String): Invoice? = transaction {
        InvoicesTable.selectAll().where { InvoicesTable.number eq number }.singleOrNull()?.toInvoice()
    }

    override suspend fun create(invoice: Invoice): Invoice = transaction {
        InvoicesTable.insert {
            it[id] = invoice.id; it[contractId] = invoice.contractId; it[calculationId] = invoice.calculationId
            it[number] = invoice.number; it[date] = invoice.date.toString(); it[type] = invoice.type.name
            it[items] = json.encodeToString(invoice.items); it[totalAmount] = invoice.totalAmount.toBigDecimal()
            it[totalVat] = invoice.totalVat.toBigDecimal(); it[totalWithVat] = invoice.totalWithVat.toBigDecimal()
            it[status] = invoice.status.name; it[createdBy] = invoice.createdBy
            it[createdAt] = Instant.now().toEpochMilli(); it[updatedAt] = Instant.now().toEpochMilli()
        }; invoice
    }

    override suspend fun update(invoice: Invoice): Invoice = transaction {
        InvoicesTable.update({ InvoicesTable.id eq invoice.id }) {
            it[number] = invoice.number; it[type] = invoice.type.name
            it[items] = json.encodeToString(invoice.items); it[totalAmount] = invoice.totalAmount.toBigDecimal()
            it[totalVat] = invoice.totalVat.toBigDecimal(); it[totalWithVat] = invoice.totalWithVat.toBigDecimal()
            it[status] = invoice.status.name; it[updatedAt] = Instant.now().toEpochMilli()
        }; invoice
    }

    override suspend fun delete(id: UUID): Boolean = transaction {
        InvoicesTable.deleteWhere { InvoicesTable.id eq id } > 0
    }

    private fun ResultRow.toInvoice(): Invoice = Invoice(
        id = this[InvoicesTable.id], contractId = this[InvoicesTable.contractId],
        calculationId = this[InvoicesTable.calculationId], number = this[InvoicesTable.number],
        date = LocalDate.parse(this[InvoicesTable.date]), type = InvoiceType.valueOf(this[InvoicesTable.type]),
        items = try { json.decodeFromString(this[InvoicesTable.items]) } catch (_: Exception) { emptyList() },
        totalAmount = this[InvoicesTable.totalAmount].toDouble(), totalVat = this[InvoicesTable.totalVat].toDouble(),
        totalWithVat = this[InvoicesTable.totalWithVat].toDouble(),
        status = InvoiceStatus.valueOf(this[InvoicesTable.status]), createdBy = this[InvoicesTable.createdBy]
    )
}

class PostgresAcceptanceActRepository : AcceptanceActRepository {
    override suspend fun findById(id: UUID): AcceptanceAct? = transaction {
        AcceptanceActsTable.selectAll().where { AcceptanceActsTable.id eq id }.singleOrNull()?.toAct()
    }

    override suspend fun findByContract(contractId: UUID): List<AcceptanceAct> = transaction {
        AcceptanceActsTable.selectAll().where { AcceptanceActsTable.contractId eq contractId }
            .orderBy(AcceptanceActsTable.createdAt to SortOrder.DESC).map { it.toAct() }
    }

    override suspend fun create(act: AcceptanceAct): AcceptanceAct = transaction {
        AcceptanceActsTable.insert {
            it[id] = act.id; it[contractId] = act.contractId; it[calculationId] = act.calculationId
            it[number] = act.number; it[date] = act.date.toString()
            it[periodFrom] = act.periodFrom.toString(); it[periodTo] = act.periodTo.toString()
            it[volume] = act.volume.toBigDecimal(); it[cost] = act.cost.toBigDecimal()
            it[status] = act.status.name; it[createdBy] = act.createdBy
            it[createdAt] = Instant.now().toEpochMilli(); it[updatedAt] = Instant.now().toEpochMilli()
        }; act
    }

    override suspend fun update(act: AcceptanceAct): AcceptanceAct = transaction {
        AcceptanceActsTable.update({ AcceptanceActsTable.id eq act.id }) {
            it[number] = act.number; it[volume] = act.volume.toBigDecimal(); it[cost] = act.cost.toBigDecimal()
            it[status] = act.status.name; it[updatedAt] = Instant.now().toEpochMilli()
        }; act
    }

    override suspend fun delete(id: UUID): Boolean = transaction {
        AcceptanceActsTable.deleteWhere { AcceptanceActsTable.id eq id } > 0
    }

    private fun ResultRow.toAct(): AcceptanceAct = AcceptanceAct(
        id = this[AcceptanceActsTable.id], contractId = this[AcceptanceActsTable.contractId],
        calculationId = this[AcceptanceActsTable.calculationId], number = this[AcceptanceActsTable.number],
        date = LocalDate.parse(this[AcceptanceActsTable.date]),
        periodFrom = LocalDate.parse(this[AcceptanceActsTable.periodFrom]),
        periodTo = LocalDate.parse(this[AcceptanceActsTable.periodTo]),
        volume = this[AcceptanceActsTable.volume].toDouble(), cost = this[AcceptanceActsTable.cost].toDouble(),
        status = ActStatus.valueOf(this[AcceptanceActsTable.status]), createdBy = this[AcceptanceActsTable.createdBy]
    )
}

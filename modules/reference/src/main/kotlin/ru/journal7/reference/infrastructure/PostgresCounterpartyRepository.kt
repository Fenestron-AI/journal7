package ru.journal7.reference.infrastructure

import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.like
import org.jetbrains.exposed.sql.transactions.transaction
import ru.journal7.core.types.Page
import ru.journal7.core.types.PageRequest
import ru.journal7.reference.domain.Counterparty
import ru.journal7.reference.domain.CounterpartyRepository
import ru.journal7.reference.domain.CounterpartyType
import java.time.Instant
import java.util.UUID

object CounterpartiesTable : Table("directory.counterparties") {
    val id = uuid("id")
    val code = varchar("code", 64).uniqueIndex()
    val name = varchar("name", 512)
    val fullName = varchar("full_name", 1024).nullable()
    val inn = varchar("inn", 12).nullable()
    val kpp = varchar("kpp", 9).nullable()
    val ogrn = varchar("ogrn", 15).nullable()
    val legalAddress = text("legal_address").nullable()
    val postalAddress = text("postal_address").nullable()
    val phone = varchar("phone", 32).nullable()
    val email = varchar("email", 256).nullable()
    val bankName = varchar("bank_name", 512).nullable()
    val bankBik = varchar("bank_bik", 9).nullable()
    val bankKs = varchar("bank_ks", 20).nullable()
    val bankRs = varchar("bank_rs", 20).nullable()
    val type = varchar("type", 32)
    val deleted = bool("deleted").default(false)
    val createdAt = long("created_at")
    val updatedAt = long("updated_at")

    override val primaryKey = PrimaryKey(id)
}

class PostgresCounterpartyRepository : CounterpartyRepository {

    override suspend fun findById(id: UUID): Counterparty? = transaction {
        CounterpartiesTable.selectAll()
            .where { (CounterpartiesTable.id eq id) and (CounterpartiesTable.deleted eq false) }
            .singleOrNull()
            ?.toCounterparty()
    }

    override suspend fun findByCode(code: String): Counterparty? = transaction {
        CounterpartiesTable.selectAll()
            .where { (CounterpartiesTable.code eq code) and (CounterpartiesTable.deleted eq false) }
            .singleOrNull()
            ?.toCounterparty()
    }

    override suspend fun search(query: String, type: CounterpartyType?, page: PageRequest): Page<Counterparty> = transaction {
        val baseQuery = CounterpartiesTable.selectAll()
            .where { CounterpartiesTable.deleted eq false }

        val filteredQuery = baseQuery.apply {
            if (query.isNotBlank()) {
                andWhere {
                    (CounterpartiesTable.name like "%$query%") or
                        (CounterpartiesTable.code like "%$query%") or
                        (CounterpartiesTable.inn like "%$query%")
                }
            }
            if (type != null) {
                andWhere { CounterpartiesTable.type eq type.name }
            }
        }

        val total = filteredQuery.count()
        val items = filteredQuery
            .orderBy(CounterpartiesTable.name)
            .limit(page.size).offset(page.offset)
            .map { it.toCounterparty() }

        Page(items = items, total = total, page = page.page, size = page.size)
    }

    override suspend fun create(counterparty: Counterparty): Counterparty = transaction {
        CounterpartiesTable.insert {
            it[id] = counterparty.id
            it[code] = counterparty.code
            it[name] = counterparty.name
            it[fullName] = counterparty.fullName
            it[inn] = counterparty.inn
            it[kpp] = counterparty.kpp
            it[ogrn] = counterparty.ogrn
            it[legalAddress] = counterparty.legalAddress
            it[postalAddress] = counterparty.postalAddress
            it[phone] = counterparty.phone
            it[email] = counterparty.email
            it[bankName] = counterparty.bankName
            it[bankBik] = counterparty.bankBik
            it[bankKs] = counterparty.bankKs
            it[bankRs] = counterparty.bankRs
            it[type] = counterparty.type.name
            it[createdAt] = Instant.now().toEpochMilli()
            it[updatedAt] = Instant.now().toEpochMilli()
        }
        counterparty
    }

    override suspend fun update(counterparty: Counterparty): Counterparty = transaction {
        CounterpartiesTable.update({ CounterpartiesTable.id eq counterparty.id }) {
            it[code] = counterparty.code
            it[name] = counterparty.name
            it[fullName] = counterparty.fullName
            it[inn] = counterparty.inn
            it[kpp] = counterparty.kpp
            it[ogrn] = counterparty.ogrn
            it[legalAddress] = counterparty.legalAddress
            it[postalAddress] = counterparty.postalAddress
            it[phone] = counterparty.phone
            it[email] = counterparty.email
            it[bankName] = counterparty.bankName
            it[bankBik] = counterparty.bankBik
            it[bankKs] = counterparty.bankKs
            it[bankRs] = counterparty.bankRs
            it[type] = counterparty.type.name
            it[updatedAt] = Instant.now().toEpochMilli()
        }
        counterparty
    }

    override suspend fun softDelete(id: UUID): Boolean = transaction {
        CounterpartiesTable.update({ CounterpartiesTable.id eq id }) {
            it[deleted] = true
            it[updatedAt] = Instant.now().toEpochMilli()
        } > 0
    }

    private fun ResultRow.toCounterparty(): Counterparty = Counterparty(
        id = this[CounterpartiesTable.id],
        code = this[CounterpartiesTable.code],
        name = this[CounterpartiesTable.name],
        fullName = this[CounterpartiesTable.fullName],
        inn = this[CounterpartiesTable.inn],
        kpp = this[CounterpartiesTable.kpp],
        ogrn = this[CounterpartiesTable.ogrn],
        legalAddress = this[CounterpartiesTable.legalAddress],
        postalAddress = this[CounterpartiesTable.postalAddress],
        phone = this[CounterpartiesTable.phone],
        email = this[CounterpartiesTable.email],
        bankName = this[CounterpartiesTable.bankName],
        bankBik = this[CounterpartiesTable.bankBik],
        bankKs = this[CounterpartiesTable.bankKs],
        bankRs = this[CounterpartiesTable.bankRs],
        type = CounterpartyType.valueOf(this[CounterpartiesTable.type]),
    )
}

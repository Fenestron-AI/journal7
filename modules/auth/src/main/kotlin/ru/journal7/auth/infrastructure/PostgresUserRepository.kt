package ru.journal7.auth.infrastructure

import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import ru.journal7.auth.domain.User
import ru.journal7.auth.domain.UserRepository
import ru.journal7.auth.domain.UserRole
import java.time.Instant
import java.util.UUID

object UsersTable : Table("settings.users") {
    val id = uuid("id")
    val username = varchar("username", 128).uniqueIndex()
    val password = varchar("password", 256)
    val fullName = varchar("full_name", 256)
    val email = varchar("email", 256).nullable()
    val role = varchar("role", 32)
    val deleted = bool("deleted").default(false)
    val deletedAt = varchar("deleted_at", 50).nullable()
    val createdAt = long("created_at")
    val updatedAt = long("updated_at")

    override val primaryKey = PrimaryKey(id)
}

class PostgresUserRepository : UserRepository {

    override suspend fun findByUsername(username: String): User? = transaction {
        UsersTable.selectAll().where { UsersTable.username eq username }
            .singleOrNull()
            ?.toUser()
    }

    override suspend fun findById(id: UUID): User? = transaction {
        UsersTable.selectAll().where { UsersTable.id eq id }
            .singleOrNull()
            ?.toUser()
    }

    override suspend fun create(user: User): User = transaction {
        UsersTable.insert {
            it[id] = user.id
            it[username] = user.username
            it[password] = user.passwordHash
            it[fullName] = user.fullName
            it[email] = user.email
            it[role] = user.role.name
            it[deleted] = user.deleted
            it[createdAt] = user.createdAt.toEpochMilli()
            it[updatedAt] = user.updatedAt.toEpochMilli()
        }
        user
    }

    override suspend fun update(user: User): User = transaction {
        UsersTable.update({ UsersTable.id eq user.id }) {
            it[fullName] = user.fullName
            it[email] = user.email
            it[role] = user.role.name
            it[updatedAt] = Instant.now().toEpochMilli()
        }
        user
    }

    override suspend fun softDelete(id: UUID): Boolean = transaction {
        UsersTable.update({ UsersTable.id eq id }) {
            it[deleted] = true
            it[deletedAt] = Instant.now().toString()
            it[updatedAt] = Instant.now().toEpochMilli()
        } > 0
    }

    override suspend fun list(page: Int, size: Int): List<User> = transaction {
        UsersTable.selectAll()
            .where { UsersTable.deleted eq false }
            .orderBy(UsersTable.fullName)
            .limit(size).offset(((page - 1) * size).toLong())
            .map { it.toUser() }
    }

    override suspend fun count(): Long = transaction {
        UsersTable.selectAll().where { UsersTable.deleted eq false }.count()
    }

    private fun ResultRow.toUser(): User = User(
        id = this[UsersTable.id],
        username = this[UsersTable.username],
        passwordHash = this[UsersTable.password],
        fullName = this[UsersTable.fullName],
        email = this[UsersTable.email],
        role = UserRole.valueOf(this[UsersTable.role]),
        deleted = this[UsersTable.deleted]
    )
}

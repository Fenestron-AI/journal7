package ru.journal7.contract.domain

import ru.journal7.core.types.DomainError
import java.util.UUID

interface SaleContractRepository {
    suspend fun findById(id: UUID): SaleContract?
    suspend fun search(query: String, counterpartyId: UUID?, page: Int, size: Int): List<SaleContract>
    suspend fun count(query: String, counterpartyId: UUID?): Long
    suspend fun create(contract: SaleContract): SaleContract
    suspend fun update(contract: SaleContract): SaleContract
    suspend fun softDelete(id: UUID): Boolean

    suspend fun findObjectsByContract(contractId: UUID): List<AccountingObject>
    suspend fun findObjectById(objectId: UUID): AccountingObject?
    suspend fun createObject(obj: AccountingObject): AccountingObject
    suspend fun updateObject(obj: AccountingObject): AccountingObject
    suspend fun softDeleteObject(objectId: UUID): Boolean

    suspend fun findDeliveryPointsByObject(objectId: UUID): List<DeliveryPoint>
    suspend fun findDeliveryPointsByContract(contractId: UUID): List<DeliveryPoint>
    suspend fun findDeliveryPointById(pointId: UUID): DeliveryPoint?
    suspend fun createDeliveryPoint(point: DeliveryPoint): DeliveryPoint
    suspend fun updateDeliveryPoint(point: DeliveryPoint): DeliveryPoint
    suspend fun softDeleteDeliveryPoint(pointId: UUID): Boolean
}

class ContractNotFound(message: String = "Contract not found") : DomainError.NotFound(message)
class ContractNumberExists(message: String = "Contract number already exists") : DomainError.Conflict(message)
class ObjectNotFound(message: String = "Accounting object not found") : DomainError.NotFound(message)
class DeliveryPointNotFound(message: String = "Delivery point not found") : DomainError.NotFound(message)
class ContractClosedPeriod(message: String = "Contract period is closed") : DomainError.ClosedPeriod(message)

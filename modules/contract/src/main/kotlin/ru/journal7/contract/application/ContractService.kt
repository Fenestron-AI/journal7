package ru.journal7.contract.application

import ru.journal7.contract.domain.*
import ru.journal7.reference.domain.CounterpartyRepository
import ru.journal7.reference.domain.CounterpartyNotFound
import java.util.UUID

class ContractService(
    private val contractRepository: SaleContractRepository,
    private val counterpartyRepository: CounterpartyRepository
) {
    suspend fun getContract(id: UUID): SaleContract {
        return contractRepository.findById(id) ?: throw ContractNotFound()
    }

    suspend fun searchContracts(query: String, counterpartyId: String?, page: Int, size: Int): Pair<List<SaleContract>, Long> {
        val cId = counterpartyId?.let { UUID.fromString(it) }
        return contractRepository.search(query, cId, page, size) to contractRepository.count(query, cId)
    }

    suspend fun createContract(request: SaleContract): SaleContract {
        val counterparty = counterpartyRepository.findById(request.counterpartyId)
            ?: throw CounterpartyNotFound("Counterparty not found")

        return contractRepository.create(request.copy(counterpartyName = counterparty.name))
    }

    suspend fun updateContract(id: UUID, request: SaleContract): SaleContract {
        contractRepository.findById(id) ?: throw ContractNotFound()
        return contractRepository.update(request.copy(id = id))
    }

    suspend fun deleteContract(id: UUID) {
        contractRepository.findById(id) ?: throw ContractNotFound()
        contractRepository.softDelete(id)
    }

    suspend fun getTree(contractId: UUID): ContractTree {
        val contract = contractRepository.findById(contractId) ?: throw ContractNotFound()
        val objects = contractRepository.findObjectsByContract(contractId)

        val objectNodes = objects.map { obj ->
            val deliveryPoints = contractRepository.findDeliveryPointsByObject(obj.id)
            ObjectNode(
                object_ = obj,
                deliveryPoints = deliveryPoints.map { dp ->
                    DeliveryPointNode(
                        deliveryPoint = dp,
                        meteringPoints = dp.meteringPoints
                    )
                }
            )
        }

        return ContractTree(contract = contract, objects = objectNodes)
    }

    // --- Objects ---

    suspend fun getObject(objectId: UUID): AccountingObject {
        return contractRepository.findObjectById(objectId) ?: throw ObjectNotFound()
    }

    suspend fun createObject(contractId: UUID, obj: AccountingObject): AccountingObject {
        contractRepository.findById(contractId) ?: throw ContractNotFound()
        return contractRepository.createObject(obj.copy(contractId = contractId))
    }

    suspend fun updateObject(objectId: UUID, obj: AccountingObject): AccountingObject {
        contractRepository.findObjectById(objectId) ?: throw ObjectNotFound()
        return contractRepository.updateObject(obj.copy(id = objectId))
    }

    suspend fun deleteObject(objectId: UUID) {
        contractRepository.findObjectById(objectId) ?: throw ObjectNotFound()
        contractRepository.softDeleteObject(objectId)
    }

    // --- Delivery points ---

    suspend fun getDeliveryPoint(pointId: UUID): DeliveryPoint {
        return contractRepository.findDeliveryPointById(pointId) ?: throw DeliveryPointNotFound()
    }

    suspend fun createDeliveryPoint(contractId: UUID, objectId: UUID, point: DeliveryPoint): DeliveryPoint {
        contractRepository.findById(contractId) ?: throw ContractNotFound()
        contractRepository.findObjectById(objectId) ?: throw ObjectNotFound()
        return contractRepository.createDeliveryPoint(point.copy(contractId = contractId, objectId = objectId))
    }

    suspend fun updateDeliveryPoint(pointId: UUID, point: DeliveryPoint): DeliveryPoint {
        contractRepository.findDeliveryPointById(pointId) ?: throw DeliveryPointNotFound()
        return contractRepository.updateDeliveryPoint(point.copy(id = pointId))
    }

    suspend fun deleteDeliveryPoint(pointId: UUID) {
        contractRepository.findDeliveryPointById(pointId) ?: throw DeliveryPointNotFound()
        contractRepository.softDeleteDeliveryPoint(pointId)
    }
}

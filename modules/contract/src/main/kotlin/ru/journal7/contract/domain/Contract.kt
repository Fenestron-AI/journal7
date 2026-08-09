package ru.journal7.contract.domain

import kotlinx.serialization.Serializable
import ru.journal7.core.types.UuidEntity
import java.time.LocalDate
import java.util.UUID

data class SaleContract(
    override val id: UUID = UUID.randomUUID(),
    val number: String,
    val counterpartyId: UUID,
    val counterpartyName: String = "",
    val dateFrom: LocalDate,
    val dateTo: LocalDate? = null,
    val type: ContractType = ContractType.ENERGY_SALE,
    val priceCategory: PriceCategory = PriceCategory.CK1,
    val calculationGroupId: UUID? = null,
    val confirmedById: UUID? = null,
    val confirmed: Boolean = false,
    val confirmedAt: java.time.Instant? = null,
    val metadata: Map<String, String> = emptyMap(),
    val deleted: Boolean = false,
) : UuidEntity()

enum class ContractType { ENERGY_SALE, POWER_SALE, ENERGY_PURCHASE, POWER_PURCHASE }
enum class PriceCategory { CK1, CK3, CK4, FCK }

data class AccountingObject(
    override val id: UUID = UUID.randomUUID(),
    val contractId: UUID,
    val name: String,
    val code: String? = null,
    val deleted: Boolean = false,
) : UuidEntity()

data class DeliveryPoint(
    override val id: UUID = UUID.randomUUID(),
    val objectId: UUID,
    val contractId: UUID,
    val name: String,
    val code: String? = null,
    val meteringPoints: List<MeteringPoint> = emptyList(),
    val deleted: Boolean = false,
) : UuidEntity()

@Serializable
data class MeteringPoint(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val code: String? = null,
    val voltageLevel: String? = null,
    val devices: List<MeterDevice> = emptyList()
)

@Serializable
data class MeterDevice(
    val id: String = UUID.randomUUID().toString(),
    val model: String? = null,
    val serialNumber: String? = null,
    val type: DeviceType = DeviceType.ACTIVE,
    val coefficient: Double = 1.0,
    val installDate: String? = null,
    val verificationDate: String? = null
)

enum class DeviceType { ACTIVE, REACTIVE, BOTH }

data class ContractTree(
    val contract: SaleContract,
    val objects: List<ObjectNode>
)

data class ObjectNode(
    val object_: AccountingObject,
    val deliveryPoints: List<DeliveryPointNode>
)

data class DeliveryPointNode(
    val deliveryPoint: DeliveryPoint,
    val meteringPoints: List<MeteringPoint>
)

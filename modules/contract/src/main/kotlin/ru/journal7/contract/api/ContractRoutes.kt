package ru.journal7.contract.api

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.koin.ktor.ext.inject
import ru.journal7.contract.api.dto.*
import ru.journal7.contract.application.ContractService
import ru.journal7.contract.domain.*
import java.time.LocalDate
import java.util.UUID

fun Route.contractRoutes() {
    val service by inject<ContractService>()

    route("/api/v1/contracts") {
        // --- Contracts ---
        get("sale") {
            val q = call.request.queryParameters["q"] ?: ""
            val cid = call.request.queryParameters["counterpartyId"]
            val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
            val size = call.request.queryParameters["size"]?.toIntOrNull() ?: 20

            val (items, total) = service.searchContracts(q, cid, page, size)
            call.respond(SaleContractListResponse(
                items = items.map { it.toResponse() }, total = total, page = page, size = size
            ))
        }

        post("sale") {
            val req = call.receive<SaleContractRequest>()
            val contract = service.createContract(req.toDomain())
            call.respond(HttpStatusCode.Created, contract.toResponse())
        }

        get("sale/{id}") {
            val id = UUID.fromString(call.parameters["id"])
            call.respond(service.getContract(id).toResponse())
        }

        put("sale/{id}") {
            val id = UUID.fromString(call.parameters["id"])
            val req = call.receive<SaleContractRequest>()
            call.respond(service.updateContract(id, req.toDomain()).toResponse())
        }

        delete("sale/{id}") {
            val id = UUID.fromString(call.parameters["id"])
            service.deleteContract(id)
            call.respond(HttpStatusCode.NoContent)
        }

        get("sale/{id}/tree") {
            val id = UUID.fromString(call.parameters["id"])
            val tree = service.getTree(id)
            call.respond(
                ContractTreeResponse(
                    contract = tree.contract.toResponse(),
                    objects = tree.objects.map { objNode ->
                        ObjectNodeResponse(
                            object_ = objNode.object_.toResponse(),
                            deliveryPoints = objNode.deliveryPoints.map { dpNode ->
                                DeliveryPointNodeResponse(
                                    deliveryPoint = dpNode.deliveryPoint.toResponse(),
                                    meteringPoints = dpNode.meteringPoints.map { it.toDto() }
                                )
                            }
                        )
                    }
                )
            )
        }

        // --- Objects ---
        post("sale/{contractId}/objects") {
            val contractId = UUID.fromString(call.parameters["contractId"])
            val req = call.receive<ObjectRequest>()
            val obj = service.createObject(contractId, req.toDomain())
            call.respond(HttpStatusCode.Created, obj.toResponse())
        }

        put("sale/objects/{objectId}") {
            val objectId = UUID.fromString(call.parameters["objectId"])
            val req = call.receive<ObjectRequest>()
            call.respond(service.updateObject(objectId, req.toDomain()).toResponse())
        }

        delete("sale/objects/{objectId}") {
            val objectId = UUID.fromString(call.parameters["objectId"])
            service.deleteObject(objectId)
            call.respond(HttpStatusCode.NoContent)
        }

        // --- Delivery points ---
        post("sale/{contractId}/objects/{objectId}/delivery-points") {
            val contractId = UUID.fromString(call.parameters["contractId"])
            val objectId = UUID.fromString(call.parameters["objectId"])
            val req = call.receive<DeliveryPointRequest>()
            val point = service.createDeliveryPoint(contractId, objectId, req.toDomain())
            call.respond(HttpStatusCode.Created, point.toResponse())
        }

        put("sale/delivery-points/{pointId}") {
            val pointId = UUID.fromString(call.parameters["pointId"])
            val req = call.receive<DeliveryPointRequest>()
            call.respond(service.updateDeliveryPoint(pointId, req.toDomain()).toResponse())
        }

        delete("sale/delivery-points/{pointId}") {
            val pointId = UUID.fromString(call.parameters["pointId"])
            service.deleteDeliveryPoint(pointId)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}

private fun SaleContractRequest.toDomain() = SaleContract(
    number = number,
    counterpartyId = UUID.fromString(counterpartyId),
    dateFrom = LocalDate.parse(dateFrom),
    dateTo = dateTo?.let { LocalDate.parse(it) },
    type = ContractType.valueOf(type.uppercase()),
    priceCategory = PriceCategory.valueOf(priceCategory.uppercase()),
    calculationGroupId = calculationGroupId?.let { UUID.fromString(it) },
    metadata = metadata
)

private fun SaleContract.toResponse() = SaleContractResponse(
    id = id.toString(),
    number = number,
    counterpartyId = counterpartyId.toString(),
    counterpartyName = counterpartyName,
    dateFrom = dateFrom.toString(),
    dateTo = dateTo?.toString(),
    type = type.name,
    priceCategory = priceCategory.name,
    calculationGroupId = calculationGroupId?.toString(),
    confirmed = confirmed,
    confirmedBy = confirmedById?.toString(),
    metadata = metadata
)

private fun ObjectRequest.toDomain() = AccountingObject(
    name = name,
    code = code,
    contractId = UUID.randomUUID()
)

private fun AccountingObject.toResponse() = ObjectResponse(
    id = id.toString(),
    contractId = contractId.toString(),
    name = name,
    code = code
)

private fun DeliveryPointRequest.toDomain() = DeliveryPoint(
    name = name,
    code = code,
    meteringPoints = meteringPoints.map { it.toDomain() },
    objectId = UUID.randomUUID(),
    contractId = UUID.randomUUID()
)

private fun DeliveryPoint.toResponse() = DeliveryPointResponse(
    id = id.toString(),
    objectId = objectId.toString(),
    contractId = contractId.toString(),
    name = name,
    code = code,
    meteringPoints = meteringPoints.map { it.toDto() }
)

private fun MeteringPointDto.toDomain() = MeteringPoint(
    id = id,
    name = name,
    code = code,
    voltageLevel = voltageLevel,
    devices = devices.map { it.toDomain() }
)

private fun MeteringPoint.toDto() = MeteringPointDto(
    id = id,
    name = name,
    code = code,
    voltageLevel = voltageLevel,
    devices = devices.map { it.toDto() }
)

private fun MeterDeviceDto.toDomain() = MeterDevice(
    id = id,
    model = model,
    serialNumber = serialNumber,
    type = DeviceType.valueOf(type.uppercase()),
    coefficient = coefficient,
    installDate = installDate,
    verificationDate = verificationDate
)

private fun MeterDevice.toDto() = MeterDeviceDto(
    id = id,
    model = model,
    serialNumber = serialNumber,
    type = type.name,
    coefficient = coefficient,
    installDate = installDate,
    verificationDate = verificationDate
)

package ru.journal7.billing.application

import ru.journal7.billing.domain.*
import ru.journal7.contract.domain.SaleContractRepository
import ru.journal7.contract.domain.ContractNotFound
import ru.journal7.calculation.domain.CalculationRepository
import java.util.UUID

class BillingService(
    private val invoiceRepository: InvoiceRepository,
    private val actRepository: AcceptanceActRepository,
    private val contractRepository: SaleContractRepository,
    private val calculationRepository: CalculationRepository
) {
    // --- Invoices ---

    suspend fun createInvoice(request: Invoice): Invoice {
        contractRepository.findById(request.contractId) ?: throw ContractNotFound()
        val existing = invoiceRepository.findByNumber(request.number)
        if (existing != null) throw InvoiceNumberExists()
        return invoiceRepository.create(request)
    }

    suspend fun getInvoice(id: UUID): Invoice {
        return invoiceRepository.findById(id) ?: throw InvoiceNotFound()
    }

    suspend fun getInvoicesByContract(contractId: UUID): List<Invoice> {
        return invoiceRepository.findByContract(contractId)
    }

    suspend fun updateInvoice(id: UUID, request: Invoice): Invoice {
        invoiceRepository.findById(id) ?: throw InvoiceNotFound()
        return invoiceRepository.update(request.copy(id = id))
    }

    suspend fun deleteInvoice(id: UUID) {
        invoiceRepository.findById(id) ?: throw InvoiceNotFound()
        invoiceRepository.delete(id)
    }

    suspend fun generateInvoiceFromCalculation(
        contractId: UUID,
        calculationId: UUID,
        number: String,
        type: InvoiceType = InvoiceType.REALIZATION
    ): Invoice {
        val contract = contractRepository.findById(contractId) ?: throw ContractNotFound()
        val calculation = calculationRepository.findById(calculationId)
            ?: throw IllegalArgumentException("Calculation not found")

        val vatRate = 20.0
        val vatAmount = calculation.totalCost * vatRate / 100.0

        val item = InvoiceItem(
            name = "Электроэнергия по договору №${contract.number}",
            unit = "МВт⋅ч",
            quantity = calculation.totalVolume,
            price = calculation.costPerMwh,
            amount = calculation.totalCost,
            vatRate = vatRate,
            vatAmount = vatAmount
        )

        return createInvoice(
            Invoice(
                contractId = contractId,
                calculationId = calculationId,
                number = number,
                date = java.time.LocalDate.now(),
                type = type,
                items = listOf(item),
                totalAmount = calculation.totalCost,
                totalVat = vatAmount,
                totalWithVat = calculation.totalCost + vatAmount,
                status = InvoiceStatus.ISSUED
            )
        )
    }

    // --- Acts ---

    suspend fun createAct(request: AcceptanceAct): AcceptanceAct {
        contractRepository.findById(request.contractId) ?: throw ContractNotFound()
        return actRepository.create(request)
    }

    suspend fun getAct(id: UUID): AcceptanceAct {
        return actRepository.findById(id) ?: throw ActNotFound()
    }

    suspend fun getActsByContract(contractId: UUID): List<AcceptanceAct> {
        return actRepository.findByContract(contractId)
    }

    suspend fun updateAct(id: UUID, request: AcceptanceAct): AcceptanceAct {
        actRepository.findById(id) ?: throw ActNotFound()
        return actRepository.update(request.copy(id = id))
    }

    suspend fun deleteAct(id: UUID) {
        actRepository.findById(id) ?: throw ActNotFound()
        actRepository.delete(id)
    }
}

package ru.journal7.calculation.application

import ru.journal7.calculation.domain.*
import ru.journal7.contract.domain.SaleContractRepository
import ru.journal7.contract.domain.ContractNotFound
import ru.journal7.reference.domain.PowerProfileRepository
import ru.journal7.reference.domain.PowerProfileNotFound
import java.util.UUID

class CalculationService(
    private val contractRepository: SaleContractRepository,
    private val powerProfileRepository: PowerProfileRepository,
    private val calculationRepository: CalculationRepository
) {
    private val strategies = mapOf<PriceCategory, CalculationStrategy>(
        PriceCategory.CK1 to CK1Strategy(),
        PriceCategory.CK3 to CK3Strategy(),
        PriceCategory.CK4 to CK4Strategy()
    )

    suspend fun runCalculation(
        contractId: UUID,
        profileId: UUID,
        tariffRates: TariffRates,
        salesMarkup: Double = 0.0,
        omCoefficient: Double = 0.0,
        infrastructurePayment: Double = 0.0,
        peakHours: Set<Int>? = null,
        halfPeakHours: Set<Int>? = null
    ): CalculationResult {
        val contract = contractRepository.findById(contractId)
            ?: throw ContractNotFound()

        val profile = powerProfileRepository.findById(profileId)
            ?: throw PowerProfileNotFound()

        val strategy = strategies[contract.priceCategory.toDomain()]
            ?: throw IllegalArgumentException("Unsupported price category: ${contract.priceCategory}")

        val powerValues = powerProfileRepository.getValues(
            profileId = profileId,
            from = contract.dateFrom,
            to = contract.dateTo ?: contract.dateFrom.plusYears(1)
        )

        val input = CalculationInput(
            contractId = contractId,
            regionId = profile.regionId ?: UUID.randomUUID(),
            priceCategory = contract.priceCategory.toDomain(),
            periodFrom = contract.dateFrom,
            periodTo = contract.dateTo ?: contract.dateFrom.plusYears(1),
            powerValues = powerValues.map {
                HourlyValue(date = it.periodDate, hour = it.hour, value = it.value)
            },
            tariffRates = tariffRates,
            salesMarkup = salesMarkup,
            omCoefficient = omCoefficient,
            infrastructurePayment = infrastructurePayment,
            peakHours = peakHours ?: PEAK_HOURS_DEFAULT,
            halfPeakHours = halfPeakHours ?: HALF_PEAK_HOURS_DEFAULT
        )

        val result = strategy.calculate(input)
        return calculationRepository.save(result)
    }

    suspend fun getCalculation(id: UUID): CalculationResult {
        return calculationRepository.findById(id)
            ?: throw CalculationNotFound()
    }

    suspend fun getCalculationsByContract(contractId: UUID): List<CalculationResult> {
        return calculationRepository.findByContract(contractId)
    }

    suspend fun deleteCalculation(id: UUID) {
        calculationRepository.delete(id)
    }
}

private fun ru.journal7.contract.domain.PriceCategory.toDomain(): PriceCategory = when (this) {
    ru.journal7.contract.domain.PriceCategory.CK1 -> PriceCategory.CK1
    ru.journal7.contract.domain.PriceCategory.CK3 -> PriceCategory.CK3
    ru.journal7.contract.domain.PriceCategory.CK4 -> PriceCategory.CK4
    ru.journal7.contract.domain.PriceCategory.FCK -> PriceCategory.FCK
}

class CalculationNotFound(message: String = "Calculation not found") : ru.journal7.core.types.DomainError.NotFound(message)

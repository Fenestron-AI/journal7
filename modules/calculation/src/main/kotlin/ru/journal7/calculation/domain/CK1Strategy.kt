package ru.journal7.calculation.domain

import ru.journal7.calculation.domain.*
import java.math.BigDecimal
import java.math.RoundingMode

class CK1Strategy : CalculationStrategy {
    override val priceCategory = PriceCategory.CK1

    override fun calculate(input: CalculationInput): CalculationResult {
        val totalVolume = input.powerValues.sumOf { it.value }
        val baseRate = input.tariffRates.singleRate
        val effectiveRate = baseRate + input.salesMarkup + input.omCoefficient + input.infrastructurePayment

        val hourlyResults = input.powerValues.map { pv ->
            val cost = round(pv.value * effectiveRate)
            HourlyResult(
                date = pv.date,
                hour = pv.hour,
                volume = pv.value,
                price = effectiveRate,
                cost = cost
            )
        }

        val totalCost = round(hourlyResults.sumOf { it.cost })

        return CalculationResult(
            contractId = input.contractId,
            priceCategory = priceCategory,
            status = CalculationStatus.COMPLETED,
            periodFrom = input.periodFrom,
            periodTo = input.periodTo,
            totalVolume = round(totalVolume),
            totalCost = totalCost,
            hourlyResults = hourlyResults,
            zoneResults = mapOf(
                "ALL" to ZoneResult(zone = "ALL", volume = round(totalVolume), rate = effectiveRate, cost = totalCost)
            )
        )
    }

    companion object {
        private fun round(value: Double, scale: Int = 6): Double =
            BigDecimal.valueOf(value).setScale(scale, RoundingMode.HALF_UP).toDouble()
    }
}

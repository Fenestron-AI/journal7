package ru.journal7.calculation.domain

import ru.journal7.calculation.domain.*
import java.math.BigDecimal
import java.math.RoundingMode

class CK4Strategy : CalculationStrategy {
    override val priceCategory = PriceCategory.CK4

    override fun calculate(input: CalculationInput): CalculationResult {
        val rateMap = input.tariffRates.hourlyRates
        if (rateMap.isEmpty()) {
            return CalculationResult(
                contractId = input.contractId,
                priceCategory = priceCategory,
                status = CalculationStatus.FAILED,
                periodFrom = input.periodFrom,
                periodTo = input.periodTo
            )
        }

        val hourlyResults = input.powerValues.map { pv ->
            val hourlyPrice = rateMap[pv.date]?.get(pv.hour) ?: 0.0
            val effectivePrice = hourlyPrice + input.salesMarkup + input.omCoefficient + input.infrastructurePayment
            val cost = round(pv.value * effectivePrice)
            HourlyResult(date = pv.date, hour = pv.hour, volume = pv.value, price = effectivePrice, cost = cost)
        }

        val totalVolume = round(input.powerValues.sumOf { it.value })
        val totalCost = round(hourlyResults.sumOf { it.cost })

        return CalculationResult(
            contractId = input.contractId,
            priceCategory = priceCategory,
            status = CalculationStatus.COMPLETED,
            periodFrom = input.periodFrom,
            periodTo = input.periodTo,
            totalVolume = totalVolume,
            totalCost = totalCost,
            hourlyResults = hourlyResults,
            zoneResults = mapOf(
                "ALL" to ZoneResult(zone = "ALL", volume = totalVolume, rate = 0.0, cost = totalCost)
            )
        )
    }

    companion object {
        private fun round(value: Double, scale: Int = 6): Double =
            BigDecimal.valueOf(value).setScale(scale, RoundingMode.HALF_UP).toDouble()
    }
}

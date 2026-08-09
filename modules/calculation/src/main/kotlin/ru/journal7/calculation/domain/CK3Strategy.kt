package ru.journal7.calculation.domain

import ru.journal7.calculation.domain.*
import java.math.BigDecimal
import java.math.RoundingMode

class CK3Strategy : CalculationStrategy {
    override val priceCategory = PriceCategory.CK3

    override fun calculate(input: CalculationInput): CalculationResult {
        val zones = classifyHours(input.powerValues, input.peakHours, input.halfPeakHours)

        val resultsByZone = mutableMapOf<String, MutableList<HourlyResult>>()
        var totalVolume = 0.0
        var totalCost = 0.0

        for ((zone, values) in zones) {
            val rate = when (zone) {
                "PEAK" -> input.tariffRates.peakRate
                "HALF_PEAK" -> input.tariffRates.halfPeakRate
                else -> input.tariffRates.offPeakRate
            }
            val effectiveRate = rate + input.salesMarkup + input.omCoefficient + input.infrastructurePayment
            val zoneVolume = values.sumOf { it.value }
            val zoneCost = round(zoneVolume * effectiveRate)

            val zoneResults = values.map { pv ->
                HourlyResult(
                    date = pv.date, hour = pv.hour, volume = pv.value,
                    price = effectiveRate, cost = round(pv.value * effectiveRate), zone = zone
                )
            }

            resultsByZone[zone] = zoneResults.toMutableList()
            totalVolume += zoneVolume
            totalCost += zoneCost
        }

        val allHourlyResults = resultsByZone.values.flatten().sortedWith(compareBy({ it.date }, { it.hour }))

        return CalculationResult(
            contractId = input.contractId,
            priceCategory = priceCategory,
            status = CalculationStatus.COMPLETED,
            periodFrom = input.periodFrom,
            periodTo = input.periodTo,
            totalVolume = round(totalVolume),
            totalCost = round(totalCost),
            hourlyResults = allHourlyResults,
            zoneResults = resultsByZone.mapValues { (zone, hrs) ->
                val rate = when (zone) {
                    "PEAK" -> input.tariffRates.peakRate
                    "HALF_PEAK" -> input.tariffRates.halfPeakRate
                    else -> input.tariffRates.offPeakRate
                }
                val effectiveRate = rate + input.salesMarkup + input.omCoefficient + input.infrastructurePayment
                val zVol = hrs.sumOf { it.volume }
                val zCost = round(zVol * effectiveRate)
                ZoneResult(zone = zone, volume = round(zVol), rate = effectiveRate, cost = zCost)
            }
        )
    }

    private fun classifyHours(
        values: List<HourlyValue>,
        peakHours: Set<Int>,
        halfPeakHours: Set<Int>
    ): Map<String, List<HourlyValue>> {
        return values.groupBy { pv ->
            when (pv.hour) {
                in peakHours -> "PEAK"
                in halfPeakHours -> "HALF_PEAK"
                else -> "OFF_PEAK"
            }
        }
    }

    companion object {
        private fun round(value: Double, scale: Int = 6): Double =
            BigDecimal.valueOf(value).setScale(scale, RoundingMode.HALF_UP).toDouble()
    }
}

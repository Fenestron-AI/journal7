package ru.journal7.reporting.application

import org.apache.poi.ss.usermodel.*
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import ru.journal7.billing.domain.Invoice
import ru.journal7.calculation.domain.CalculationResult
import ru.journal7.reporting.domain.*
import java.io.ByteArrayOutputStream
import java.time.format.DateTimeFormatter

class ExcelReportService {

    fun generateBillReport(invoice: Invoice): ReportResult {
        val workbook = XSSFWorkbook()
        val sheet = workbook.createSheet("Счет")

        val headerStyle = workbook.createCellStyle().apply {
            fillForegroundColor = IndexedColors.GREY_25_PERCENT.index
            fillPattern = FillPatternType.SOLID_FOREGROUND
            setFont(workbook.createFont().apply { bold = true })
        }

        val currencyStyle = workbook.createCellStyle().apply {
            dataFormat = workbook.createDataFormat().getFormat("#,##0.00")
        }

        var rowIdx = 0
        fun row() = sheet.createRow(rowIdx++)
        fun Row.cell(idx: Int, value: String, style: CellStyle? = null) {
            createCell(idx).apply { setCellValue(value); style?.let { cellStyle = it } }
        }

        row().cell(0, "СЧЕТ НА ОПЛАТУ №${invoice.number} от ${invoice.date.format(DateTimeFormatter.ofPattern("dd.MM.yyyy"))}", headerStyle)
        rowIdx++
        row().cell(0, "Тип: ${invoice.type.name}")
        row().cell(0, "Сумма без НДС: ${invoice.totalAmount}")
        row().cell(0, "НДС: ${invoice.totalVat}")
        row().cell(0, "Итого с НДС: ${invoice.totalWithVat}")
        rowIdx++

        val headerRow = row()
        headerRow.cell(0, "Наименование", headerStyle)
        headerRow.cell(1, "Кол-во", headerStyle)
        headerRow.cell(2, "Цена", headerStyle)
        headerRow.cell(3, "Сумма", headerStyle)
        headerRow.cell(4, "НДС", headerStyle)

        for (item in invoice.items) {
            val r = row()
            r.cell(0, item.name)
            r.cell(1, item.quantity.toString())
            r.cell(2, item.price.toString(), currencyStyle)
            r.cell(3, item.amount.toString(), currencyStyle)
            r.cell(4, item.vatAmount.toString(), currencyStyle)
        }

        for (i in 0..4) sheet.autoSizeColumn(i)

        val bytes = ByteArrayOutputStream().use { workbook.write(it); it.toByteArray() }
        workbook.close()

        return ReportResult(
            fileName = "invoice_${invoice.number}.xlsx",
            contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            data = bytes
        )
    }

    fun generateCalculationReport(result: CalculationResult): ReportResult {
        val workbook = XSSFWorkbook()
        val sheet = workbook.createSheet("Расчет")

        val df = DateTimeFormatter.ofPattern("dd.MM.yyyy")
        var rowIdx = 0
        fun row() = sheet.createRow(rowIdx++)

        row().createCell(0).setCellValue("Расчет за период ${result.periodFrom.format(df)} — ${result.periodTo.format(df)}")
        row().createCell(0).setCellValue("Ценовая категория: ${result.priceCategory.name}")
        row().createCell(0).setCellValue("Общий объем: ${result.totalVolume} МВт⋅ч")
        row().createCell(0).setCellValue("Общая стоимость: ${result.totalCost} руб.")
        rowIdx++

        val hdr = row()
        hdr.createCell(0).setCellValue("Дата")
        hdr.createCell(1).setCellValue("Час")
        hdr.createCell(2).setCellValue("Объем")
        hdr.createCell(3).setCellValue("Цена")
        hdr.createCell(4).setCellValue("Стоимость")
        hdr.createCell(5).setCellValue("Зона")

        result.hourlyResults.forEach { hr ->
            val r = row()
            r.createCell(0).setCellValue(hr.date.format(df))
            r.createCell(1).setCellValue(hr.hour.toDouble())
            r.createCell(2).setCellValue(hr.volume)
            r.createCell(3).setCellValue(hr.price)
            r.createCell(4).setCellValue(hr.cost)
            r.createCell(5).setCellValue(hr.zone ?: "")
        }

        for (i in 0..5) sheet.autoSizeColumn(i)

        val bytes = ByteArrayOutputStream().use { workbook.write(it); it.toByteArray() }
        workbook.close()

        return ReportResult(
            fileName = "calculation_${result.id}.xlsx",
            contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            data = bytes
        )
    }
}

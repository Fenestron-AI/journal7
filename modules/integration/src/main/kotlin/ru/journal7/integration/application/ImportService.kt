package ru.journal7.integration.application

import org.apache.poi.ss.usermodel.WorkbookFactory
import ru.journal7.integration.domain.*
import ru.journal7.reference.domain.*
import java.io.InputStream
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID

class ImportService(
    private val counterpartyRepository: CounterpartyRepository,
    private val powerProfileRepository: PowerProfileRepository
) {
    suspend fun importCounterparties(stream: InputStream): ImportResult {
        val workbook = WorkbookFactory.create(stream)
        val sheet = workbook.getSheetAt(0)
        val errors = mutableListOf<ImportError>()
        var imported = 0

        for (rowIdx in 1..sheet.lastRowNum) {
            val row = sheet.getRow(rowIdx) ?: continue
            try {
                val counterparty = Counterparty(
                    code = row.getCell(0)?.stringCellValue ?: continue,
                    name = row.getCell(1)?.stringCellValue ?: continue,
                    inn = row.getCell(2)?.stringCellValue,
                    kpp = row.getCell(3)?.stringCellValue,
                    phone = row.getCell(4)?.stringCellValue,
                    email = row.getCell(5)?.stringCellValue
                )

                val existing = counterpartyRepository.findByCode(counterparty.code)
                if (existing != null) {
                    counterpartyRepository.update(counterparty.copy(id = existing.id))
                } else {
                    counterpartyRepository.create(counterparty)
                }
                imported++
            } catch (e: Exception) {
                errors.add(ImportError(row = rowIdx + 1, field = "", message = e.message ?: "Unknown error"))
            }
        }
        workbook.close()
        return ImportResult(totalRows = sheet.lastRowNum, imported = imported, skipped = 0, errors = errors)
    }

    suspend fun importPowerProfileValues(profileId: UUID, stream: InputStream): ImportResult {
        val workbook = WorkbookFactory.create(stream)
        val sheet = workbook.getSheetAt(0)
        val values = mutableListOf<PowerProfileValue>()
        val errors = mutableListOf<ImportError>()
        val dateFormatter = DateTimeFormatter.ofPattern("dd.MM.yyyy")

        for (rowIdx in 1..sheet.lastRowNum) {
            val row = sheet.getRow(rowIdx) ?: continue
            try {
                val date = LocalDate.parse(row.getCell(0)?.stringCellValue ?: continue, dateFormatter)
                for (hour in 0..23) {
                    val cell = row.getCell(hour + 1) ?: continue
                    values.add(
                        PowerProfileValue(
                            profileId = profileId,
                            periodDate = date,
                            hour = hour,
                            value = cell.numericCellValue
                        )
                    )
                }
            } catch (e: Exception) {
                errors.add(ImportError(row = rowIdx + 1, field = "", message = e.message ?: "Unknown error"))
            }
        }

        val imported = powerProfileRepository.upsertValues(profileId, values)
        workbook.close()
        return ImportResult(totalRows = sheet.lastRowNum, imported = imported, skipped = 0, errors = errors)
    }
}

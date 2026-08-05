import { Workbook } from 'exceljs';

const BRAND_COLOR = 'FF006B8F';
const TEXT_COLOR = 'FF374151';
const STRIPE_COLOR = 'FFF9FAFB';

export interface ExcelExportOptions {
  /** Downloaded file name, e.g. 'daily-in-out-report-2026-08-05.xlsx' */
  fileName: string;
  /** Worksheet tab name */
  sheetName?: string;
  /** Report title, shown centered above the table */
  title: string;
  /** Optional lines shown centered under the title (date, totals, etc.) */
  infoLines?: string[];
  /** Table column headers */
  columns: string[];
  /** Table row data, in the same column order as `columns` */
  rows: (string | number)[][];
  /** Explicit column widths; falls back to auto-sizing from header text if omitted */
  columnWidths?: number[];
  /** Number of trailing rows in `rows` that are summary/footer rows (styled bold, brand-colored, no stripe) */
  footerRowCount?: number;
}

/**
 * Builds a styled .xlsx workbook mirroring the layout of the PDF reports
 * (centered title, optional info lines, a brand-colored header row, striped
 * body rows) and triggers a browser download.
 */
export async function exportToExcel(options: ExcelExportOptions): Promise<void> {
  const {
    fileName,
    sheetName = 'Report',
    title,
    infoLines = [],
    columns,
    rows,
    columnWidths,
    footerRowCount = 0,
  } = options;

  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  const colCount = columns.length;

  const titleRow = sheet.addRow([title]);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, colCount);
  titleRow.getCell(1).font = { size: 16, bold: true, color: { argb: BRAND_COLOR } };
  titleRow.getCell(1).alignment = { horizontal: 'center' };

  for (const line of infoLines) {
    const row = sheet.addRow([line]);
    sheet.mergeCells(row.number, 1, row.number, colCount);
    row.getCell(1).font = { size: 11, color: { argb: TEXT_COLOR } };
    row.getCell(1).alignment = { horizontal: 'center' };
  }

  sheet.addRow([]);

  const headerRow = sheet.addRow(columns);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLOR } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  rows.forEach((rowData, index) => {
    const row = sheet.addRow(rowData);
    const isFooterRow = footerRowCount > 0 && index >= rows.length - footerRowCount;

    if (isFooterRow) {
      row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: BRAND_COLOR } };
      });
    } else {
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle' };
        if (index % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE_COLOR } };
        }
      });
    }
  });

  if (columnWidths && columnWidths.length === colCount) {
    columnWidths.forEach((width, i) => {
      sheet.getColumn(i + 1).width = width;
    });
  } else {
    columns.forEach((col, i) => {
      sheet.getColumn(i + 1).width = Math.max(col.length + 4, 12);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

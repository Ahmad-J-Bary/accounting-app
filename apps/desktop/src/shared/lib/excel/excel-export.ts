import XLSX from 'xlsx-js-style';
import ExcelJS from 'exceljs';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@shared/lib/invoke';

export interface ExcelExportColumn {
  id: string;
  label: string;
  hidden?: boolean;
  width?: number;
  accessor?: (row: Record<string, unknown>) => string | number | null | undefined;
  imageDataUrl?: (row: Record<string, unknown>) => string | null | undefined;
  imageWidth?: number;
  imageHeight?: number;
  numeric?: boolean;
  decimalPlaces?: number;
  formula?: string;
  currencyCode?: string;
  currencySymbol?: string;
  isDate?: boolean;
}

function extractBase64(dataUrl: string): { base64: string; extension: string } | null {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  return { base64: match[2], extension: match[1] };
}

function getRowOffset(options?: ExcelExportOptions): number {
  let offset = 0;
  if (options?.title) {
    offset += 1;
  }
  if (options?.metadata && options.metadata.length > 0) {
    offset += Math.ceil(options.metadata.length / 2);
  }
  if (offset > 0) {
    offset += 1; // plus blank row for spacing
  }
  return offset;
}

const CURRENCY_LOCALE_MAP: Record<string, { symbol: string; locale: string }> = {
  USD: { symbol: '$', locale: 'en-US' },
  EUR: { symbol: '€', locale: 'en-US' },
  GBP: { symbol: '£', locale: 'en-GB' },
  TRY: { symbol: '₺', locale: 'tr-TR' },
  SAR: { symbol: 'ر.س', locale: 'ar-SA' },
  SYP: { symbol: 'ل.س', locale: 'ar-SA' },
  EGP: { symbol: 'ج.م', locale: 'ar-EG' },
  AED: { symbol: 'د.إ', locale: 'ar-AE' },
  IQD: { symbol: 'د.ع', locale: 'ar-IQ' },
  JOD: { symbol: 'د.ا', locale: 'ar-JO' },
  KWD: { symbol: 'د.ك', locale: 'ar-KW' },
  QAR: { symbol: 'ر.ق', locale: 'ar-QA' },
  OMR: { symbol: 'ر.ع', locale: 'ar-OM' },
  BHD: { symbol: 'د.ب', locale: 'ar-BH' },
  LBP: { symbol: 'ل.ل', locale: 'ar-LB' },
  YER: { symbol: 'ر.ي', locale: 'ar-YE' },
  TND: { symbol: 'د.ت', locale: 'ar-TN' },
  DZD: { symbol: 'د.ج', locale: 'ar-DZ' },
  MAD: { symbol: 'د.م', locale: 'ar-MA' },
  LYD: { symbol: 'د.ل', locale: 'ar-LY' },
  SDG: { symbol: 'ج.س', locale: 'ar-SD' },
};

function getNumFmt(
  decimals: number,
  numeralSystem?: string,
  currencyCode?: string,
  currencySymbol?: string,
): string {
  const pattern = decimals > 0 ? `#,##0.${'0'.repeat(decimals)}` : '#,##0';
  if (currencyCode) {
    const entry = CURRENCY_LOCALE_MAP[currencyCode];
    if (entry) return `[$${entry.symbol}-${entry.locale}] ${pattern}`;
  }
  if (currencySymbol) return `[$${currencySymbol}] ${pattern}`;
  const locale = numeralSystem === "arab" ? "[$-ar-SA]" : "[$-en-US]";
  return locale + pattern;
}

async function buildExcelJsWorkbook(
  data: Record<string, unknown>[],
  columns: ExcelExportColumn[],
  sheetName: string,
  options?: ExcelExportOptions,
): Promise<ExcelJS.Buffer> {
  const sortedData = sortExportRows(data, columns, options?.sortBy);
  const hasImages = columns.some(c => c.imageDataUrl);
  const rowOffset = getRowOffset(options);

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  workbook.creator = 'ERP System';

  const ws = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 + rowOffset, xSplit: 0 } as unknown as ExcelJS.WorksheetView],
  });
  ws.views[0].rightToLeft = true;

  ws.columns = columns.map(col => ({
    width: col.imageDataUrl ? Math.ceil((col.imageWidth ?? 80) / 7) : (col.width ?? 18),
    hidden: col.hidden || false,
  }));

  let currentRowNum = 1;
  if (options?.title) {
    const titleRow = ws.getRow(currentRowNum);
    titleRow.getCell(1).value = options.title;
    titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(currentRowNum, 1, currentRowNum, columns.length);
    titleRow.height = 30;
    currentRowNum++;
  }

  if (options?.metadata && options.metadata.length > 0) {
    const metadata = options.metadata;
    for (let i = 0; i < metadata.length; i += 2) {
      const metaRow = ws.getRow(currentRowNum);
      metaRow.height = 20;

      // Item 1
      metaRow.getCell(1).value = metadata[i].label + ":";
      metaRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF475569' } };
      metaRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
      metaRow.getCell(2).value = metadata[i].value;
      metaRow.getCell(2).font = { size: 10, color: { argb: 'FF0F172A' } };
      metaRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

      // Item 2
      if (i + 1 < metadata.length) {
        metaRow.getCell(4).value = metadata[i + 1].label + ":";
        metaRow.getCell(4).font = { bold: true, size: 10, color: { argb: 'FF475569' } };
        metaRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
        metaRow.getCell(5).value = metadata[i + 1].value;
        metaRow.getCell(5).font = { size: 10, color: { argb: 'FF0F172A' } };
        metaRow.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
      }
      currentRowNum++;
    }
  }

  if (rowOffset > 0) {
    currentRowNum++; // Blank spacing row
  }

  const headerRow = ws.getRow(rowOffset + 1);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  headerRow.height = hasImages ? 30 : 20;

  const maxImageHeight = hasImages
    ? Math.max(...columns.filter(c => c.imageDataUrl).map(c => c.imageHeight ?? 80))
    : 0;
  const imageRowHeight = hasImages ? Math.ceil(maxImageHeight * 0.75) + 5 : 0;

  const numeralSystem = options?.numeralSystem || "latn";

  if (sortedData.length > 0) {
    sortedData.forEach((row, rowIdx) => {
      const excelRowNum = rowIdx + 2 + rowOffset;
      const excelRow = ws.getRow(excelRowNum);
      if (imageRowHeight) excelRow.height = imageRowHeight;

      columns.forEach((col, colIdx) => {
        const cell = excelRow.getCell(colIdx + 1);

        if (col.formula) {
          const formula = resolveFormula(col.formula, columns, excelRowNum);
          cell.value = { formula };
          const decimals = col.decimalPlaces ?? 0;
          cell.numFmt = getNumFmt(decimals, numeralSystem, col.currencyCode, col.currencySymbol);
        } else {
          const val = getCellValue(row, col);

          if (col.isDate && val) {
            cell.value = new Date(val as string);
            cell.numFmt = 'yyyy/mm/dd, hh:mm AM/PM';
          } else {
            if (val !== null && val !== undefined && val !== "") {
              const numVal = typeof val === "number" ? val : parseFloat(val as string) || 0;
              if (!isNaN(numVal) && col.numeric) {
                const decimals = col.decimalPlaces ?? 0;
                cell.numFmt = getNumFmt(decimals, numeralSystem, col.currencyCode, col.currencySymbol);
              }
            }
            cell.value = val ?? '';
          }
        }

        cell.font = { size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    if (options?.summary) {
      const summaryRowNum = sortedData.length + 2 + rowOffset;
      const summaryRow = ws.getRow(summaryRowNum);
      columns.forEach((col, colIdx) => {
        const cell = summaryRow.getCell(colIdx + 1);
        const cellValue = buildSummaryCellValue(col, colIdx, sortedData.length, columns, options, rowOffset);
        if (cellValue.f) {
          cell.value = { formula: cellValue.f.substring(1) };
          cell.font = { bold: true, size: 10 };
          const decimals = col.decimalPlaces ?? 0;
          cell.numFmt = getNumFmt(decimals, numeralSystem, col.currencyCode, col.currencySymbol);
        } else {
          cell.value = cellValue.v ?? '';
          cell.font = { bold: true, size: 10 };
        }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    }
  }

  if (hasImages) {
    for (let rowIdx = 0; rowIdx < sortedData.length; rowIdx++) {
      const row = sortedData[rowIdx];
      columns.forEach((col, colIdx) => {
        if (!col.imageDataUrl) return;
        const dataUrl = col.imageDataUrl(row);
        if (!dataUrl) return;

        const parsed = extractBase64(dataUrl);
        if (!parsed) return;

        const imageId = workbook.addImage({
          base64: parsed.base64,
          extension: parsed.extension as 'png' | 'jpeg' | 'gif',
        });

        ws.addImage(imageId, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ExcelJS Anchor class not exported; plain {col,row} works at runtime
          tl: { col: colIdx, row: rowIdx + 1 + rowOffset } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same reason
          br: { col: colIdx + 1, row: rowIdx + 2 + rowOffset } as any,
          editAs: 'twoCell',
        });
      });
    }
  }

  if (options?.autoFilter !== false) {
    const firstNonImageCol = columns.findIndex(c => !c.imageDataUrl) + 1;
    if (firstNonImageCol > 0 && firstNonImageCol <= columns.length) {
      ws.autoFilter = {
        from: { row: 1 + rowOffset, column: firstNonImageCol },
        to: { row: sortedData.length + 1 + rowOffset, column: columns.length },
      };
    }
  }

  if (options?.mergeCells && options.mergeCells.length > 0) {
    const shiftedMerges = options.mergeCells.map(m => ({
      ...m,
      startRow: m.startRow + rowOffset,
      endRow: m.endRow + rowOffset,
    }));
    applyExcelJsMerges(ws, columns, shiftedMerges);
  }

  if (options?.currencyRatesSheet && options.currencyRatesSheet.rates.length > 0) {
    const ratesSheet = workbook.addWorksheet(options.currencyRatesSheet.sheetName || 'أسعار الصرف');
    ratesSheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 } as unknown as ExcelJS.WorksheetView];
    ratesSheet.views[0].rightToLeft = true;

    ratesSheet.columns = [
      { width: 22 },
      { width: 30 },
      { width: 16 },
      { width: 10 },
    ];

    const bc = options.currencyRatesSheet.baseCurrency;

    const hdrStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    };
    const dataStyle: Partial<ExcelJS.Style> = {
      font: { size: 10 },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
    };

    // Header row
    const hdrRow = ratesSheet.getRow(1);
    hdrRow.getCell(1).value = 'النوع';
    hdrRow.getCell(2).value = 'العملة';
    hdrRow.getCell(3).value = 'السعر';
    hdrRow.getCell(4).value = 'الرمز';
    [1, 2, 3, 4].forEach(i => {
      const cell = hdrRow.getCell(i);
      cell.font = hdrStyle.font;
      cell.fill = hdrStyle.fill;
      cell.alignment = hdrStyle.alignment;
    });
    hdrRow.height = 22;

    // Base currency row
    const baseRow = ratesSheet.getRow(2);
    baseRow.getCell(1).value = 'العملة الأساسية';
    baseRow.getCell(2).value = `${bc.name_ar} ${bc.code}`;
    baseRow.getCell(3).value = 1;
    baseRow.getCell(4).value = bc.symbol;
    [1, 2, 3, 4].forEach(i => {
      const cell = baseRow.getCell(i);
      cell.font = { bold: true, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = dataStyle.border;
    });
    baseRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    baseRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    baseRow.getCell(3).numFmt = '#,##0';
    baseRow.height = 20;

    // Secondary currency rows
    const rates = options.currencyRatesSheet.rates;
    const secondaryLabel = 'العملات الثانوية المقابلة';
    rates.forEach((r, idx) => {
      const rowNum = idx + 3;
      const row = ratesSheet.getRow(rowNum);
      row.getCell(1).value = secondaryLabel;
      row.getCell(2).value = `${r.name_ar} ${r.currency_code}`;
      row.getCell(3).value = r.rate;
      row.getCell(4).value = r.symbol;
      [1, 2, 3, 4].forEach(i => {
        const cell = row.getCell(i);
        cell.font = { size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = dataStyle.border;
      });
      row.getCell(3).numFmt = '#,##0.##';
      row.height = 20;
    });

    // Merge column A for "العملات الثانوية المقابلة" across all secondary currency rows
    if (rates.length > 1) {
      ratesSheet.mergeCells(3, 1, 2 + rates.length, 1);
    }
  }

  if (options?.additionalSummary && options.additionalSummary.length > 0) {
    let currentSummaryRowNum = sortedData.length + (options.summary ? 3 : 2) + rowOffset;
    ws.getRow(currentSummaryRowNum).height = 15; // Blank row spacing
    currentSummaryRowNum++;

    options.additionalSummary.forEach((item) => {
      const itemRow = ws.getRow(currentSummaryRowNum);
      itemRow.height = 20;
      itemRow.getCell(1).value = item.label + ":";
      itemRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF475569' } };
      itemRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

      const numVal = typeof item.value === 'number' ? item.value : parseFloat(String(item.value));
      const isNum = !isNaN(numVal) && typeof item.value !== 'string';
      if (isNum) {
        itemRow.getCell(2).value = numVal;
        itemRow.getCell(2).numFmt = '#,##0.00';
      } else {
        itemRow.getCell(2).value = item.value;
      }
      itemRow.getCell(2).font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
      itemRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      currentSummaryRowNum++;
    });
  }

  return workbook.xlsx.writeBuffer() as Promise<ExcelJS.Buffer>;
}

function hasImageColumns(columns: ExcelExportColumn[]): boolean {
  return columns.some(c => c.imageDataUrl);
}

export interface ExcelExportOptions {
  sheetName?: string;
  autoFilter?: boolean;
  mergeCells?: Array<{
    columnId: string;
    startRow: number;
    endRow: number;
  }>;
  sortBy?: {
    columnId: string;
    direction?: 'asc' | 'desc';
    compare?: (a: Record<string, unknown>, b: Record<string, unknown>) => number;
  };
  numeralSystem?: 'arab' | 'latn';
  summary?: Record<string, string | null>;
  summaryLabel?: string;
  title?: string;
  metadata?: Array<{ label: string; value: string | number }>;
  additionalSummary?: Array<{ label: string; value: string | number }>;
  /** When provided, a second worksheet with exchange rates is appended to the workbook. */
  currencyRatesSheet?: {
    sheetName?: string;
    baseCurrency: { code: string; name_ar: string; symbol: string };
    rates: Array<{ currency_code: string; rate: number; name_ar: string; symbol: string }>;
  };
}

export function buildCurrencyRatesSheetOptions(
  baseCurrency: { code: string; name_ar: string; symbol: string } | null,
  currencies: { code: string; name_ar: string; symbol: string }[],
  rateMap: Map<string, number>,
  currencyMode: "fixed" | "variable",
): { currencyRatesSheet?: {
  sheetName?: string;
  baseCurrency: { code: string; name_ar: string; symbol: string };
  rates: Array<{ currency_code: string; rate: number; name_ar: string; symbol: string }>;
} } {
  if (currencyMode !== "variable" || !baseCurrency) return {};
  const nonBase = currencies.filter(c => c.code !== baseCurrency.code);
  if (nonBase.length === 0) return {};
  return {
    currencyRatesSheet: {
      sheetName: "أسعار الصرف",
      baseCurrency: { code: baseCurrency.code, name_ar: baseCurrency.name_ar, symbol: baseCurrency.symbol },
      rates: nonBase.map(c => ({
        currency_code: c.code,
        rate: rateMap.get(c.code) || 1,
        name_ar: c.name_ar,
        symbol: c.symbol,
      })),
    },
  };
}

function getVisibleColumnIndex(columns: ExcelExportColumn[], columnId: string): number {
  return columns.findIndex((column) => column.id === columnId);
}

function applyExcelJsMerges(
  ws: ExcelJS.Worksheet,
  columns: ExcelExportColumn[],
  merges?: ExcelExportOptions['mergeCells'],
) {
  if (!merges?.length) return;

  merges.forEach((merge) => {
    const columnIndex = getVisibleColumnIndex(columns, merge.columnId);
    if (columnIndex === -1 || merge.endRow <= merge.startRow) return;

    ws.mergeCells(merge.startRow + 2, columnIndex + 1, merge.endRow + 2, columnIndex + 1);
  });
}

function applySheetMerges(
  ws: XLSX.WorkSheet,
  columns: ExcelExportColumn[],
  merges?: ExcelExportOptions['mergeCells'],
) {
  if (!merges?.length) return;

  const sheetMerges = merges.flatMap((merge) => {
    const columnIndex = getVisibleColumnIndex(columns, merge.columnId);
    if (columnIndex === -1 || merge.endRow <= merge.startRow) return [];

    return [{
      s: { r: merge.startRow + 1, c: columnIndex },
      e: { r: merge.endRow + 1, c: columnIndex },
    }];
  });

  if (sheetMerges.length > 0) {
    ws['!merges'] = [...(ws['!merges'] || []), ...sheetMerges];
  }
}

const HEADER_STYLE = {
  fill: { fgColor: { rgb: '1E293B' } },
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  border: {
    top: { style: 'thin' as const, color: { auto: 1 } },
    bottom: { style: 'thin' as const, color: { auto: 1 } },
    left: { style: 'thin' as const, color: { auto: 1 } },
    right: { style: 'thin' as const, color: { auto: 1 } },
  },
};

const DATA_STYLE = {
  font: { sz: 10 },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  border: {
    top: { style: 'thin' as const, color: { auto: 1 } },
    bottom: { style: 'thin' as const, color: { auto: 1 } },
    left: { style: 'thin' as const, color: { auto: 1 } },
    right: { style: 'thin' as const, color: { auto: 1 } },
  },
};

const SUMMARY_STYLE = {
  font: { bold: true, sz: 10 },
  fill: { fgColor: { rgb: 'F1F5F9' } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  border: {
    top: { style: 'thin' as const, color: { auto: 1 } },
    bottom: { style: 'thin' as const, color: { auto: 1 } },
    left: { style: 'thin' as const, color: { auto: 1 } },
    right: { style: 'thin' as const, color: { auto: 1 } },
  },
};

function getCellValue(
  row: Record<string, unknown>,
  column: ExcelExportColumn,
): string | number | null | undefined {
  return column.accessor ? column.accessor(row) : (row[column.id] as string | number | null | undefined);
}

function sortExportRows(
  data: Record<string, unknown>[],
  columns: ExcelExportColumn[],
  sortBy?: ExcelExportOptions['sortBy'],
) {
  if (!sortBy) {
    return data;
  }

  const sortColumn = columns.find((column) => column.id === sortBy.columnId);
  if (!sortColumn) {
    return data;
  }

  const direction = sortBy.direction === 'desc' ? -1 : 1;
  return [...data].sort((a, b) => {
    const comparison = sortBy.compare
      ? sortBy.compare(a, b)
      : (() => {
          const aVal = getCellValue(a, sortColumn);
          const bVal = getCellValue(b, sortColumn);
          const aNumber = Number(aVal);
          const bNumber = Number(bVal);

          if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
            return aNumber - bNumber;
          }

          return String(aVal ?? '').localeCompare(String(bVal ?? ''), 'ar');
        })();

    return comparison * direction;
  });
}

function getExcelColumnLetter(index: number): string {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function resolveFormula(template: string, columns: ExcelExportColumn[], rowIndex: number): string {
  return template.replace(/\{col\('([^']+)'\)\}/g, (_, colId: string) => {
    const idx = columns.findIndex(c => c.id === colId);
    return idx >= 0 ? getExcelColumnLetter(idx) : '?';
  }).replace(/\{row\}/g, String(rowIndex));
}

function buildSummaryCellValue(
  col: ExcelExportColumn,
  colIdx: number,
  dataLength: number,
  columns: ExcelExportColumn[],
  options: ExcelExportOptions,
  rowOffset = 0,
): { v: string | number; f?: string } {
  if (colIdx === 0 && options.summaryLabel) {
    return { v: options.summaryLabel };
  }

  const aggType = options.summary?.[col.id];
  if (!aggType) {
    return { v: '' };
  }

  const colLetter = getExcelColumnLetter(colIdx);
  const firstDataRow = 2 + rowOffset;
  const lastDataRow = dataLength + 1 + rowOffset;

  // Predefined aggregates
  if (aggType === 'sum' || aggType === 'average' || aggType === 'subtotal') {
    let formula: string;
    switch (aggType) {
      case 'sum':
        formula = `SUM(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})`;
        break;
      case 'average':
        formula = `AVERAGE(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})`;
        break;
      case 'subtotal':
      default:
        formula = `SUBTOTAL(109, ${colLetter}${firstDataRow}:${colLetter}${lastDataRow})`;
        break;
    }
    return { v: 0, f: '=' + formula };
  }

  // Custom formula — resolve {col('id')}, {firstRow}, {lastRow}
  const resolved = aggType
    .replace(/\{col\('([^']+)'\)\}/g, (_, colId: string) => {
      const idx = columns.findIndex(c => c.id === colId);
      return idx >= 0 ? getExcelColumnLetter(idx) : '?';
    })
    .replace(/\{firstRow\}/g, String(firstDataRow))
    .replace(/\{lastRow\}/g, String(lastDataRow))
    .replace(/\{summaryRow\}/g, String(lastDataRow + 1));

  return { v: 0, f: '=' + resolved };
}

function buildWorkbook(
  data: Record<string, unknown>[],
  columns: ExcelExportColumn[],
  sheetName: string,
  options?: ExcelExportOptions,
): XLSX.WorkBook {
  const sortedData = sortExportRows(data, columns, options?.sortBy);
  const rowOffset = getRowOffset(options);
  
  const wsData: unknown[][] = [];

  // Title Row
  if (options?.title) {
    const titleRow = Array(columns.length).fill({ v: "", t: 's' as const, s: {} });
    titleRow[0] = { 
      v: options.title, 
      t: 's' as const, 
      s: { 
        font: { bold: true, sz: 14, color: { rgb: '1E293B' } }, 
        alignment: { horizontal: 'center', vertical: 'center' } 
      } 
    };
    wsData.push(titleRow);
  }

  // Metadata Row(s) - 2 items per row
  if (options?.metadata && options.metadata.length > 0) {
    const metadata = options.metadata;
    for (let i = 0; i < metadata.length; i += 2) {
      const metaRow = Array(columns.length).fill({ v: "", t: 's' as const, s: {} });
      
      metaRow[0] = { v: metadata[i].label + ":", t: 's' as const, s: { font: { bold: true, sz: 10, color: { rgb: '475569' } }, alignment: { horizontal: 'right' } } };
      metaRow[1] = { v: metadata[i].value, t: typeof metadata[i].value === 'number' ? 'n' : 's', s: { font: { sz: 10, color: { rgb: '0F172A' } }, alignment: { horizontal: 'left' } } };

      if (i + 1 < metadata.length) {
        metaRow[3] = { v: metadata[i + 1].label + ":", t: 's' as const, s: { font: { bold: true, sz: 10, color: { rgb: '475569' } }, alignment: { horizontal: 'right' } } };
        metaRow[4] = { v: metadata[i + 1].value, t: typeof metadata[i + 1].value === 'number' ? 'n' : 's', s: { font: { sz: 10, color: { rgb: '0F172A' } }, alignment: { horizontal: 'left' } } };
      }
      wsData.push(metaRow);
    }
  }

  // Blank spacing row
  if (rowOffset > 0) {
    wsData.push(Array(columns.length).fill({ v: "", t: 's' as const, s: {} }));
  }

  // Main table header row
  const headerRow = columns.map(col => ({ v: col.label, t: 's' as const, s: HEADER_STYLE }));
  wsData.push(headerRow);

  // Main table data rows
  const dataRows = sortedData.map((row, rowIdx) =>
    columns.map(col => {
      if (col.formula) {
        const excelRowNum = rowIdx + 2 + rowOffset;
        const formula = resolveFormula(col.formula, columns, excelRowNum);
        const decimals = col.decimalPlaces ?? 0;
        const fmt = getNumFmt(decimals, options?.numeralSystem, col.currencyCode, col.currencySymbol);
        return { f: '=' + formula, t: 'n' as const, s: { ...DATA_STYLE, numFmt: fmt } };
      }

      const val = getCellValue(row, col);
      const cellStyle: Record<string, unknown> = { ...DATA_STYLE };
      if (col.isDate && val) {
        return { v: new Date(val as string), t: 'd' as const, s: { ...cellStyle, numFmt: 'yyyy/mm/dd, hh:mm AM/PM' } };
      }
      if (col.numeric && typeof val === 'number') {
        const decimals = col.decimalPlaces ?? 0;
        cellStyle.numFmt = getNumFmt(decimals, options?.numeralSystem, col.currencyCode, col.currencySymbol);
      }
      return { v: val ?? '', t: typeof val === 'number' ? ('n' as const) : ('s' as const), s: cellStyle };
    })
  );
  wsData.push(...dataRows);

  // Summary Row
  if (options?.summary && sortedData.length > 0) {
    const summaryRow = columns.map((col, colIdx) => {
      const cellValue = buildSummaryCellValue(col, colIdx, sortedData.length, columns, options, rowOffset);
      if (cellValue.f) {
        const cellStyle: Record<string, unknown> = { ...SUMMARY_STYLE };
        if (col.numeric) {
          const decimals = col.decimalPlaces ?? 0;
          cellStyle.numFmt = getNumFmt(decimals, options?.numeralSystem, col.currencyCode, col.currencySymbol);
        }
        return { f: cellValue.f, t: 'n' as const, s: cellStyle };
      }
      return { v: cellValue.v, t: typeof cellValue.v === 'number' ? ('n' as const) : ('s' as const), s: SUMMARY_STYLE };
    });
    wsData.push(summaryRow);
  }

  // Additional Summary Key-value pairs
  if (options?.additionalSummary && options.additionalSummary.length > 0) {
    wsData.push(Array(columns.length).fill({ v: "", t: 's' as const, s: {} })); // Blank row
    options.additionalSummary.forEach((item) => {
      const itemRow = Array(columns.length).fill({ v: "", t: 's' as const, s: {} });
      itemRow[0] = { v: item.label + ":", t: 's' as const, s: { font: { bold: true, sz: 10, color: { rgb: '475569' } }, alignment: { horizontal: 'right' } } };
      
      const numVal = typeof item.value === 'number' ? item.value : parseFloat(String(item.value));
      const isNum = !isNaN(numVal) && typeof item.value !== 'string';
      const cellStyle: Record<string, unknown> = { font: { bold: true, sz: 10, color: { rgb: '0F172A' } }, alignment: { horizontal: 'left' } };
      if (isNum) {
        cellStyle.numFmt = '#,##0.00';
      }
      itemRow[1] = { v: isNum ? numVal : item.value, t: isNum ? 'n' as const : 's' as const, s: cellStyle };
      wsData.push(itemRow);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = columns.map(col => ({
    hidden: col.hidden || false,
    wch: col.width ?? 18,
  }));

  if (options?.autoFilter !== false && sortedData.length > 0) {
    const firstDataRow = 1 + rowOffset;
    const lastDataRow = sortedData.length + 1 + rowOffset;
    const lastColLetter = getExcelColumnLetter(columns.length - 1);
    ws['!autofilter'] = { ref: `A${firstDataRow}:${lastColLetter}${lastDataRow}` };
  }

  if (options?.mergeCells && options.mergeCells.length > 0) {
    const shiftedMerges = options.mergeCells.map(m => ({
      ...m,
      startRow: m.startRow + rowOffset,
      endRow: m.endRow + rowOffset,
    }));
    applySheetMerges(ws, columns, shiftedMerges);
  }

  // Handle Sheet Title Merge specifically
  if (options?.title) {
    const titleMerge = {
      s: { r: 0, c: 0 },
      e: { r: 0, c: columns.length - 1 }
    };
    ws['!merges'] = [...(ws['!merges'] || []), titleMerge];
  }

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  wb.Workbook.Sheets = [{ Hidden: 0 }];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 + rowOffset };
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  if (options?.currencyRatesSheet && options.currencyRatesSheet.rates.length > 0) {
    const ratesSheetName = options.currencyRatesSheet.sheetName || 'أسعار الصرف';
    const bc = options.currencyRatesSheet.baseCurrency;
    const secondaryLabel = 'العملات الثانوية المقابلة';

    const baseRowStyle = { ...DATA_STYLE, font: { ...DATA_STYLE.font, bold: true }, fill: { fgColor: { rgb: 'F8FAFC' } } } as typeof DATA_STYLE;

    const ratesData: unknown[][] = [
      // Header row
      [
        { v: 'النوع', t: 's' as const, s: HEADER_STYLE },
        { v: 'العملة', t: 's' as const, s: HEADER_STYLE },
        { v: 'السعر', t: 's' as const, s: HEADER_STYLE },
        { v: 'الرمز', t: 's' as const, s: HEADER_STYLE },
      ],
      // Base currency row
      [
        { v: 'العملة الأساسية', t: 's' as const, s: baseRowStyle },
        { v: `${bc.name_ar} ${bc.code}`, t: 's' as const, s: baseRowStyle },
        { v: 1, t: 'n' as const, s: { ...baseRowStyle, numFmt: '#,##0' } as XLSX.CellStyle },
        { v: bc.symbol, t: 's' as const, s: baseRowStyle },
      ],
      // Secondary currency rows
      ...options.currencyRatesSheet.rates.map(r => [
        { v: secondaryLabel, t: 's' as const, s: DATA_STYLE },
        { v: `${r.name_ar} ${r.currency_code}`, t: 's' as const, s: DATA_STYLE },
        { v: r.rate, t: 'n' as const, s: { ...DATA_STYLE, numFmt: '#,##0.##' } as XLSX.CellStyle },
        { v: r.symbol, t: 's' as const, s: DATA_STYLE },
      ]),
    ];

    const ratesWs = XLSX.utils.aoa_to_sheet(ratesData);
    ratesWs['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 16 }, { wch: 10 }];

    // Merge "العملات الثانوية المقابلة" cells in column A across secondary rows
    const secondaryCount = options.currencyRatesSheet.rates.length;
    if (secondaryCount > 1) {
      const merges: XLSX.Range[] = [{
        s: { r: 2, c: 0 },
        e: { r: 1 + secondaryCount, c: 0 },
      }];
      ratesWs['!merges'] = [...(ratesWs['!merges'] || []), ...merges];
    }

    ratesWs['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ratesWs, ratesSheetName);
    wb.Workbook!.Sheets!.push({ Hidden: 0 });
  }

  return wb;
}

export function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExcelExportColumn[],
  filename: string,
  options?: ExcelExportOptions,
): void {
  if (!data || data.length === 0) return;

  const wb = buildWorkbook(data, columns, options?.sheetName || 'Sheet1', options);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  link.style.position = 'absolute';
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcelBuffer(
  data: Record<string, unknown>[],
  columns: ExcelExportColumn[],
  options?: ExcelExportOptions,
): Uint8Array {
  const wb = buildWorkbook(data, columns, options?.sheetName || 'Sheet1', options);
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(buf);
}

export async function saveExcelFile(
  data: Record<string, unknown>[],
  columns: ExcelExportColumn[],
  filename: string,
  options?: ExcelExportOptions,
): Promise<boolean> {
  const defaultName = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;

  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: 'ملف إكسل', extensions: ['xlsx'] }],
  });

  if (!path) return false;

  let buffer: Uint8Array;
  if (hasImageColumns(columns)) {
    const excelBuf = await buildExcelJsWorkbook(data, columns, options?.sheetName || 'Sheet1', options);
    buffer = new Uint8Array(excelBuf);
  } else {
    buffer = exportToExcelBuffer(data, columns, options);
  }

  await invoke<string>('save_file', { path, data: Array.from(buffer) });

  return true;
}

export default exportToExcel;

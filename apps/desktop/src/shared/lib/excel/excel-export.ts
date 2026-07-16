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
}

function extractBase64(dataUrl: string): { base64: string; extension: string } | null {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  return { base64: match[2], extension: match[1] };
}

async function buildExcelJsWorkbook(
  data: Record<string, unknown>[],
  columns: ExcelExportColumn[],
  sheetName: string,
  options?: ExcelExportOptions,
): Promise<ExcelJS.Buffer> {
  const sortedData = sortExportRows(data, columns, options?.sortBy);
  const visibleColumns = columns.filter(c => !c.hidden);
  const hasImages = visibleColumns.some(c => c.imageDataUrl);

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  workbook.creator = 'ERP System';

  const ws = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0 } as unknown as ExcelJS.WorksheetView],
  });
  ws.views[0].rightToLeft = true;

  ws.columns = visibleColumns.map(col => ({
    width: col.imageDataUrl ? Math.ceil((col.imageWidth ?? 80) / 7) : (col.width ?? 12),
    hidden: col.hidden || false,
  }));

  const headerRow = ws.getRow(1);
  visibleColumns.forEach((col, i) => {
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
    ? Math.max(...visibleColumns.filter(c => c.imageDataUrl).map(c => c.imageHeight ?? 80))
    : 0;
  const imageRowHeight = hasImages ? Math.ceil(maxImageHeight * 0.75) + 5 : 0;

  sortedData.forEach((row, rowIdx) => {
    const excelRow = ws.getRow(rowIdx + 2);
    if (imageRowHeight) excelRow.height = imageRowHeight;

    visibleColumns.forEach((col, colIdx) => {
      const cell = excelRow.getCell(colIdx + 1);
      const val = getCellValue(row, col);
      cell.value = val ?? '';
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

  if (hasImages) {
    for (let rowIdx = 0; rowIdx < sortedData.length; rowIdx++) {
      const row = sortedData[rowIdx];
      visibleColumns.forEach((col, colIdx) => {
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
          tl: { col: colIdx, row: rowIdx + 1 } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same reason
          br: { col: colIdx + 1, row: rowIdx + 2 } as any,
          editAs: 'twoCell',
        });
      });
    }
  }

  if (options?.autoFilter !== false && visibleColumns.length > 0) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: sortedData.length + 1, column: visibleColumns.length },
    };
  }

  return workbook.xlsx.writeBuffer() as Promise<ExcelJS.Buffer>;
}

function hasImageColumns(columns: ExcelExportColumn[]): boolean {
  return columns.some(c => !c.hidden && c.imageDataUrl);
}

export interface ExcelExportOptions {
  sheetName?: string;
  autoFilter?: boolean;
  sortBy?: {
    columnId: string;
    direction?: 'asc' | 'desc';
    compare?: (a: Record<string, unknown>, b: Record<string, unknown>) => number;
  };
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

function buildWorkbook(
  data: Record<string, unknown>[],
  columns: ExcelExportColumn[],
  sheetName: string,
  options?: ExcelExportOptions,
): XLSX.WorkBook {
  const sortedData = sortExportRows(data, columns, options?.sortBy);
  const headerRow = columns.map(col => ({ v: col.label, t: 's' as const, s: HEADER_STYLE }));
  const dataRows = sortedData.map(row =>
    columns.map(col => {
      const val = getCellValue(row, col);
      return { v: val ?? '', t: typeof val === 'number' ? ('n' as const) : ('s' as const), s: DATA_STYLE };
    })
  );

  const wsData = [headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = columns.map(col => ({
    hidden: col.hidden || false,
    wch: col.width ?? (col.hidden ? 0 : 12),
  }));
  ws['!autofilter'] = options?.autoFilter === false ? undefined : { ref: ws['!ref'] || 'A1' };

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  wb.Workbook.Sheets = [{ Hidden: 0 }];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

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

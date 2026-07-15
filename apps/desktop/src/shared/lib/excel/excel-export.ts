import XLSX from 'xlsx-js-style';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@shared/lib/invoke';

export interface ExcelExportColumn {
  id: string;
  label: string;
  hidden?: boolean;
  width?: number;
  accessor?: (row: Record<string, unknown>) => string | number | null | undefined;
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

function buildWorkbook(
  data: Record<string, unknown>[],
  columns: ExcelExportColumn[],
  sheetName: string,
): XLSX.WorkBook {
  const headerRow = columns.map(col => ({ v: col.label, t: 's' as const, s: HEADER_STYLE }));
  const dataRows = data.map(row =>
    columns.map(col => {
      const val = col.accessor ? col.accessor(row) : row[col.id];
      return { v: val ?? '', t: typeof val === 'number' ? ('n' as const) : ('s' as const), s: DATA_STYLE };
    })
  );

  const wsData = [headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = columns.map(col => ({
    hidden: col.hidden || false,
    wch: col.width ?? (col.hidden ? 0 : 12),
  }));

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  return wb;
}

export function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExcelExportColumn[],
  filename: string,
  sheetName = 'Sheet1'
): void {
  if (!data || data.length === 0) return;

  const wb = buildWorkbook(data, columns, sheetName);
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
  sheetName = 'Sheet1',
): Uint8Array {
  const wb = buildWorkbook(data, columns, sheetName);
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(buf);
}

export async function saveExcelFile(
  data: Record<string, unknown>[],
  columns: ExcelExportColumn[],
  filename: string,
  sheetName = 'Sheet1',
): Promise<boolean> {
  const defaultName = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;

  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: 'ملف إكسل', extensions: ['xlsx'] }],
  });

  if (!path) return false;

  const buffer = exportToExcelBuffer(data, columns, sheetName);
  await invoke<string>('save_file', { path, data: Array.from(buffer) });

  return true;
}

export default exportToExcel;

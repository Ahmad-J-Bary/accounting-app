import type { ExcelExportColumn, ExcelExportOptions } from "./excel-export";

export interface ExportConfig {
  sheetName: string;
  filename: string;
  data: Record<string, unknown>[];
  columns: ExcelExportColumn[];
  summary?: Record<string, string | null>;
  summaryLabel?: string;
  additionalSummary?: { label: string; value: string | number }[];
  sortBy?: {
    columnId: string;
    direction: 'asc' | 'desc';
    compare?: (a: Record<string, unknown>, b: Record<string, unknown>) => number;
  };
  currencyRatesSheet?: ExcelExportOptions['currencyRatesSheet'];
  mergeCells?: ExcelExportOptions['mergeCells'];
  numeralSystem?: ExcelExportOptions['numeralSystem'];
}

export async function executeExport(
  exportData: (
    data: Record<string, unknown>[],
    columns: ExcelExportColumn[],
    filename: string,
    options?: ExcelExportOptions,
  ) => Promise<boolean>,
  config: ExportConfig,
): Promise<void> {
  const { sheetName, filename, data, columns, summary, summaryLabel, additionalSummary, sortBy, currencyRatesSheet, mergeCells, numeralSystem } = config;

  const options: ExcelExportOptions = {
    sheetName,
    autoFilter: true,
    ...(sortBy ? { sortBy } : {}),
    ...(summary && Object.keys(summary).length > 0 ? { summary, summaryLabel } : {}),
    ...(additionalSummary && additionalSummary.length > 0 ? { additionalSummary } : {}),
    ...(mergeCells ? { mergeCells } : {}),
    ...(numeralSystem ? { numeralSystem } : {}),
    ...(currencyRatesSheet ? { currencyRatesSheet } : {}),
  };

  await exportData(data, columns, filename, options);
}

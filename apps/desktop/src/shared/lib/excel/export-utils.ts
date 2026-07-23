import type { ExcelExportColumn } from "./excel-export";

export function estimateExcelWidth(headerText: string, sampleValues: string[], maxSamples = 30): number {
  const samples = sampleValues.slice(0, maxSamples);
  const longestText = [headerText, ...samples].reduce((max, value) => {
    return Math.max(max, String(value ?? "").trim().length);
  }, 0);
  return Math.max(12, Math.min(36, longestText + 4));
}

export function buildCurrencySummary(
  prefix: string,
  currencies: { code: string }[],
): Record<string, 'subtotal'> {
  const summary: Record<string, 'subtotal'> = {};
  for (const c of currencies) {
    summary[`${prefix}_${c.code}`] = 'subtotal';
  }
  return summary;
}

export function addCurrencySummary(
  summary: Record<string, string | null>,
  prefix: string,
  currencies: { code: string }[],
): void {
  for (const c of currencies) {
    summary[`${prefix}_${c.code}`] = 'subtotal';
  }
}

export function mergeCurrencySummaries(
  ...builders: Record<string, 'subtotal'>[]
): Record<string, 'subtotal'> {
  const result: Record<string, 'subtotal'> = {};
  for (const b of builders) {
    Object.assign(result, b);
  }
  return result;
}

export function applyVisibilityToCurrencyCols(
  cols: ExcelExportColumn[],
  visibleIds: Set<string>,
): void {
  for (const col of cols) {
    if (!visibleIds.has(col.id)) {
      col.hidden = true;
    }
  }
}

import type { ExcelExportColumn } from "./excel-export";

export function currencyAmountCols(
  prefix: string,
  label: string,
  valueAccessor: (row: Record<string, unknown>) => number,
  currencies: { code: string; symbol?: string }[],
  formatAmount: (amount: number, opts: { currencyCode: string }) => string,
  emptyValue: string | number = "",
  numeric?: boolean,
): ExcelExportColumn[] {
  return currencies.map(curr => ({
    id: `${prefix}_${curr.code}`,
    label: `${label} (${curr.symbol || curr.code})`,
    accessor: (row: Record<string, unknown>) => {
      const val = valueAccessor(row);
      if (val === 0) return numeric ? 0 : emptyValue;
      return numeric ? val : formatAmount(val, { currencyCode: curr.code });
    },
    numeric: numeric ? true : undefined,
    decimalPlaces: numeric ? 2 : undefined,
  }));
}

import type { ExcelExportColumn } from "./excel-export";
import { currencyAmountCols } from "./column-helpers";

export function dateCol(
  id: string,
  label: string,
  accessor: (row: Record<string, unknown>) => string | undefined | null,
): ExcelExportColumn {
  return {
    id,
    label,
    isDate: true,
    width: 18,
    accessor: (row) => {
      const val = accessor(row);
      if (!val) return null;
      return val;
    },
  };
}

export function currencyAccessor(
  baseAmount: number,
  currencyCode: string,
  baseCode: string,
  rateMap?: Map<string, number>,
): number {
  if (currencyCode === baseCode) return baseAmount;
  if (!rateMap) return baseAmount;
  const rate = rateMap.get(currencyCode);
  if (rate && rate > 0) return baseAmount * rate;
  return baseAmount;
}

export function debitCreditExportCol(
  id: string,
  label: string,
  side: "debit" | "credit",
  getAmount: (row: Record<string, unknown>) => number,
  getCurrencyCode: (row: Record<string, unknown>) => string,
  baseCode: string,
  rateMap?: Map<string, number>,
): ExcelExportColumn {
  return {
    id,
    label,
    numeric: true,
    decimalPlaces: 2,
    width: 15,
    accessor: (row) => {
      const amount = getAmount(row);
      if (amount === 0) return 0;
      const code = getCurrencyCode(row);
      const converted = currencyAccessor(amount, code, baseCode, rateMap);
      return side === "credit" ? -converted : converted;
    },
  };
}

export function simpleCol(
  id: string,
  label: string,
  accessor: (row: Record<string, unknown>) => string | number,
): ExcelExportColumn {
  return { id, label, accessor };
}

export function numberCol(
  id: string,
  label: string,
  accessor: (row: Record<string, unknown>) => number,
  decimalPlaces = 2,
): ExcelExportColumn {
  return { id, label, numeric: true, decimalPlaces, accessor };
}

export function currencyColSet(
  prefix: string,
  label: string,
  valueAccessor: (row: Record<string, unknown>) => number,
  currencies: { code: string; symbol?: string }[],
  formatAmount: (amount: number, opts: { currencyCode: string }) => string,
  opts: {
    baseCurrencyCode?: string;
    rateMap?: Map<string, number>;
    currencyMode?: "fixed" | "variable";
    hasSecondaryCurrencies?: boolean;
    emptyValue?: string | number;
    numeric?: boolean;
  } = {},
): ExcelExportColumn[] {
  const { baseCurrencyCode, rateMap, currencyMode = "fixed", hasSecondaryCurrencies = true, emptyValue = "", numeric = true } = opts;
  return currencyAmountCols(
    prefix,
    label,
    valueAccessor,
    currencies,
    formatAmount,
    emptyValue,
    numeric,
    hasSecondaryCurrencies,
    currencyMode,
    baseCurrencyCode,
    rateMap,
  );
}

export function debitCreditColSet(
  sortedCurrencies: { code: string; symbol?: string }[],
  baseCode: string,
  rateMap: Map<string, number> | undefined,
  getAmount: (row: Record<string, unknown>, code: string) => { debit: number; credit: number },
): ExcelExportColumn[] {
  const cols: ExcelExportColumn[] = [];
  sortedCurrencies.forEach(curr => {
    cols.push({
      id: `debit_${curr.code}`,
      label: `مدين${curr.symbol ? ` (${curr.symbol})` : ` (${curr.code})`}`,
      numeric: true,
      decimalPlaces: 2,
      width: 15,
      accessor: (row) => {
        const { debit } = getAmount(row, curr.code);
        return currencyAccessor(Math.abs(debit), curr.code, baseCode, rateMap);
      },
    });
    cols.push({
      id: `credit_${curr.code}`,
      label: `دائن${curr.symbol ? ` (${curr.symbol})` : ` (${curr.code})`}`,
      numeric: true,
      decimalPlaces: 2,
      width: 15,
      accessor: (row) => {
        const { credit } = getAmount(row, curr.code);
        return -currencyAccessor(Math.abs(credit), curr.code, baseCode, rateMap);
      },
    });
  });
  return cols;
}

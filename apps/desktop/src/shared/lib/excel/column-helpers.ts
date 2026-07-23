import type { ExcelExportColumn } from "./excel-export";

export function debitCreditAmountCols(
  getBaseAmount: (row: Record<string, unknown>) => { debit: number; credit: number },
  currencies: { code: string; symbol?: string }[],
  hasSecondaryCurrencies: boolean,
  currencyMode: "fixed" | "variable",
  baseCode: string,
  rateMap?: Map<string, number>,
): ExcelExportColumn[] {
  const dummyFormat = () => "";
  const debitCols = currencyAmountCols(
    "debit", "مدين", (row) => getBaseAmount(row).debit,
    currencies, dummyFormat, "", true, hasSecondaryCurrencies, currencyMode, baseCode, rateMap,
  );
  const creditCols = currencyAmountCols(
    "credit", "دائن", (row) => -getBaseAmount(row).credit,
    currencies, dummyFormat, "", true, hasSecondaryCurrencies, currencyMode, baseCode, rateMap,
  );
  return [...debitCols, ...creditCols];
}

export function currencyAmountCols(
  prefix: string,
  label: string,
  valueAccessor: (row: Record<string, unknown>) => number,
  currencies: { code: string; symbol?: string }[],
  formatAmount: (amount: number, opts: { currencyCode: string }) => string,
  emptyValue: string | number = "",
  numeric?: boolean,
  hasSecondaryCurrencies = true,
  currencyMode: "fixed" | "variable" = "fixed",
  baseCurrencyCode?: string,
  rateMap?: Map<string, number>,
): ExcelExportColumn[] {
  const cs = (sym: string) => hasSecondaryCurrencies ? ` (${sym})` : '';
  const baseCode = baseCurrencyCode || currencies[0]?.code || '';
  const nonBase = currencies.filter(c => c.code !== baseCode);

  return currencies.map(curr => {
    const isBase = curr.code === baseCode;

    if (!isBase && currencyMode === "variable") {
      const rateIdx = nonBase.findIndex(c => c.code === curr.code);
      const rateRow = rateIdx + 3;
      return {
        id: `${prefix}_${curr.code}`,
        label: `${label}${cs(curr.symbol || curr.code)}`,
        formula: `{col('${prefix}_${baseCode}')}{row}*'أسعار الصرف'!C${rateRow}`,
        numeric: numeric ? true : undefined,
        decimalPlaces: numeric ? 2 : undefined,
        currencyCode: curr.code,
        currencySymbol: curr.symbol || curr.code,
      };
    }

    return {
      id: `${prefix}_${curr.code}`,
      label: `${label}${cs(curr.symbol || curr.code)}`,
      accessor: (row: Record<string, unknown>) => {
        const val = valueAccessor(row);
        if (val === 0) return numeric ? 0 : emptyValue;
        if (numeric) {
          if (!isBase && rateMap) {
            const rate = rateMap.get(curr.code);
            if (rate && rate > 0) return val * rate;
          }
          return val;
        }
        return formatAmount(val, { currencyCode: curr.code });
      },
      numeric: numeric ? true : undefined,
      decimalPlaces: numeric ? 2 : undefined,
      currencyCode: curr.code,
      currencySymbol: curr.symbol || curr.code,
    };
  });
}

import type { ExcelExportColumn } from "./excel-export";

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
        return numeric ? val : formatAmount(val, { currencyCode: curr.code });
      },
      numeric: numeric ? true : undefined,
      decimalPlaces: numeric ? 2 : undefined,
      currencyCode: curr.code,
      currencySymbol: curr.symbol || curr.code,
    };
  });
}

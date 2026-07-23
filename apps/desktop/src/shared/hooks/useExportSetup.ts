import { useMemo } from "react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useExportSettings } from "./useExportSettings";
import { useExcelExport } from "./useExcelExport";
import { buildCurrencyRatesSheetOptions } from "@shared/lib/excel";

export function useExportSetup() {
  const { baseCurrency, rateMap, currencies, formatAmount } = useCurrencyContext();
  const { currencyMode } = useExportSettings();
  const { exportData } = useExcelExport();
  const baseCode = baseCurrency?.code || "";

  const ratesSheet = useMemo(
    () => buildCurrencyRatesSheetOptions(baseCurrency, currencies, rateMap, currencyMode).currencyRatesSheet,
    [baseCurrency, currencies, rateMap, currencyMode],
  );

  const sortedCurrencies = useMemo(() => {
    if (!baseCurrency) return currencies;
    return [baseCurrency, ...currencies.filter(c => c.code !== baseCurrency.code)];
  }, [currencies, baseCurrency]);

  return {
    baseCurrency,
    rateMap,
    currencies,
    sortedCurrencies,
    formatAmount,
    baseCode,
    currencyMode,
    exportData,
    ratesSheet,
  };
}

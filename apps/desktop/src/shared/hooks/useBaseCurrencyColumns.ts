import { useMemo } from "react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import type { Currency } from "@modules/core/api/currencyService";

export interface BaseCurrencyColumnsResult {
  baseCurrency: Currency | null;
  baseCurrencyCode: string | null;
  secondaryCodes: string[];
  isBaseCurrency: (code: string | null | undefined) => boolean;
  hasBaseCurrency: boolean;
  hasSecondaryCurrencies: boolean;
}

export function useBaseCurrencyColumns(): BaseCurrencyColumnsResult {
  const { baseCurrency, currencies } = useCurrencyContext();

  const baseCode = baseCurrency?.code ?? null;

  const secondaryCodes = useMemo(
    () => currencies.filter((c) => c.code !== baseCode).map((c) => c.code),
    [currencies, baseCode],
  );

  const isBaseCurrency = (code: string | null | undefined): boolean =>
    code != null && code !== "" && code === baseCode;

  return {
    baseCurrency,
    baseCurrencyCode: baseCode,
    secondaryCodes,
    isBaseCurrency,
    hasBaseCurrency: baseCode != null,
    hasSecondaryCurrencies: secondaryCodes.length > 0,
  };
}

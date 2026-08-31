import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getExchangeRate, toBase, fromBase } from "@shared/lib/currency-strategy";
import type { Currency } from "@erp/shared-types";

export interface UseCurrencyFieldOptions {
  initialCurrency?: string;
  initialAmount?: string | number;
  initialFxRate?: string;
  /** When true, the hook will NOT auto-fill fxRate on currency change.
   *  Use this in edit mode to preserve the stored historical rate. */
  disableAutoFx?: boolean;
}

export interface UseCurrencyFieldReturn {
  currency: string;
  setCurrency: (code: string) => void;
  amount: string;
  setAmount: (val: string) => void;
  fxRate: string;
  setFxRate: (rate: string) => void;
  symbol: string;
  currencies: Currency[];
  hasMultipleCurrencies: boolean;
  baseCurrencyCode: string;
  getDefaultCurrency: () => string;
  /** Convert an amount between any two currencies using current rates. */
  convertBetween: (amount: number, fromCode: string, toCode: string) => number;
}

export function useCurrencyField(
  options: UseCurrencyFieldOptions = {},
): UseCurrencyFieldReturn {
  const {
    currencies,
    baseCurrency,
    rateMap,
    hasMultipleCurrencies,
  } = useCurrencyContext();

  const baseCurrencyCode = baseCurrency?.code ?? "";

  const [currency, setCurrency] = useState<string>(
    options.initialCurrency ?? baseCurrencyCode,
  );
  const [amount, setAmount] = useState<string>(
    String(options.initialAmount ?? ""),
  );
  const [fxRate, setFxRate] = useState<string>(
    options.initialFxRate ?? "1",
  );

  // Track whether auto-fx is disabled (for edit mode)
  const autoFxDisabled = useRef(options.disableAutoFx ?? false);

  // Auto-fill exchange rate when currency changes (unless disabled)
  useEffect(() => {
    if (!autoFxDisabled.current && currency) {
      const rate = getExchangeRate(currency, rateMap, baseCurrency?.code);
      setFxRate(String(rate));
    }
  }, [currency, rateMap, baseCurrency]);

  // Compute currency symbol
  const symbol = useMemo(
    () => currencies.find((c) => c.code === currency)?.symbol ?? "",
    [currencies, currency],
  );

  // Get default currency: base currency or first active currency
  const getDefaultCurrency = useCallback(
    (): string => {
      if (baseCurrencyCode) return baseCurrencyCode;
      const firstActive = currencies.find((c) => c.is_active);
      return firstActive?.code ?? "";
    },
    [baseCurrencyCode, currencies],
  );

  // Convert an amount between any two currencies via base as intermediate
  const convertBetween = useCallback(
    (amount: number, fromCode: string, toCode: string): number => {
      if (fromCode === toCode) return amount;
      const inBase = toBase(amount, fromCode, rateMap, baseCurrency?.code ?? null);
      return fromBase(inBase, toCode, rateMap, baseCurrency?.code ?? null);
    },
    [rateMap, baseCurrency],
  );

  return {
    currency,
    setCurrency,
    amount,
    setAmount,
    fxRate,
    setFxRate,
    symbol,
    currencies,
    hasMultipleCurrencies,
    baseCurrencyCode,
    getDefaultCurrency,
    convertBetween,
  };
}

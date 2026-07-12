import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

import type { ReportFilters } from "@shared/types/report";

export function useReportFilters(defaultFromDate?: string, defaultToDate?: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { baseCurrency, currencies } = useCurrencyContext();

  const [filters, setFilters] = useState<ReportFilters>({
    from_date: defaultFromDate ?? new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    to_date: defaultToDate ?? new Date().toISOString().split("T")[0],
  });

  const [selectedCurrency, setSelectedCurrency] = useState<string>(baseCurrency?.code ?? "");

  const currencyOptions = currencies.map((c) => ({
    label: `${c.code} - ${c.name_ar}`,
    value: c.code,
  }));

  useEffect(() => {
    const fromUrl = searchParams.get("from_date");
    const toUrl = searchParams.get("to_date");
    const currencyUrl = searchParams.get("currency");

    if (fromUrl && toUrl) {
      setFilters((prev) => ({ ...prev, from_date: fromUrl, to_date: toUrl }));
    }
    if (currencyUrl) {
      setSelectedCurrency(currencyUrl);
    }
  }, [searchParams]);

  const updateFilters = useCallback(
    (newFilters: Partial<ReportFilters>) => {
      setFilters((prev) => {
        const updated = { ...prev, ...newFilters };
        const params = new URLSearchParams(searchParams);
        params.set("from_date", updated.from_date);
        params.set("to_date", updated.to_date);
        setSearchParams(params, { replace: true });
        return updated;
      });
    },
    [searchParams, setSearchParams]
  );

  const handleCurrencyChange = useCallback(
    (currencyCode: string) => {
      setSelectedCurrency(currencyCode);
      const params = new URLSearchParams(searchParams);
      params.set("currency", currencyCode);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  return {
    filters,
    setFilters: updateFilters,
    selectedCurrency,
    setSelectedCurrency: handleCurrencyChange,
    baseCurrency,
    currencies,
    currencyOptions,
  };
}

export function useReportFiltersWithDefaults(defaults: {
  from_date: string;
  to_date: string;
}) {
  return useReportFilters(defaults.from_date, defaults.to_date);
}
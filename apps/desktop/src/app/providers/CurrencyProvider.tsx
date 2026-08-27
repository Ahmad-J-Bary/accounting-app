import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { currencyService, type Currency, type TodayRateStatus } from '@modules/core/api/currencyService';
import { useNavigate } from "react-router-dom";
import { 
  CurrencyContext, 
  type CurrencyContextValue, 
  type CurrencyDisplayMode,
  formatWithLocale 
} from "./CurrencyContext";
import {
  toBase as strategyToBase,
  fromBase as strategyFromBase,
  convertBetween as strategyConvertBetween,
} from "@shared/lib/currency-strategy";
import { setNumberingSystem } from "@shared/lib/format";
import { settingsService } from "@modules/core/api/settingsService";

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [todayStatus, setTodayStatus] = useState<TodayRateStatus[]>([]);
  const [displayCurrencyCode, setDisplayCurrencyCodeState] = useState<string | null>(null);
  const [displayMode, setDisplayModeState] = useState<CurrencyDisplayMode>("selected");

  const load = useCallback(async () => {
    try {
      const context = await currencyService.getCurrencyContext();
      setCurrencies(context.active_currencies);
      setTodayStatus(context.today_status);

      if (import.meta.env.DEV) {
        console.log("[CurrencyProvider] load() today_status:", JSON.stringify(context.today_status, null, 2));
        console.log("[CurrencyProvider] load() base_currency_code:", context.base_currency_code);
      }

      if (!context.base_currency_code || context.active_currencies.length === 0) {
        setDisplayCurrencyCodeState(null);
        return;
      }

      const baseCode = context.base_currency_code;
      const storedCode = localStorage.getItem("currency-display-code");
      const nextCode = storedCode || baseCode;
      const isValid = context.active_currencies.some((c) => c.code === nextCode);
      setDisplayCurrencyCodeState(isValid ? nextCode : baseCode);

      const storedMode = localStorage.getItem("currency-display-mode");
      if (storedMode === "base" || storedMode === "selected") {
        setDisplayModeState(storedMode);
      }
    } catch (err) {
      console.error("[CurrencyProvider] Failed to load currency context:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    settingsService.getSettings().then((s) => {
      setNumberingSystem(s.numeral_system || "western");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && currencies.length === 0) {
      navigate("/setup", { replace: true });
    }
  }, [loading, currencies.length, navigate]);

  const baseCurrency = useMemo(
    () => currencies.find((c) => c.is_base) ?? null,
    [currencies]
  );

  const hasMultipleCurrencies = useMemo(
    () => currencies.filter((c) => c.is_active !== false).length > 1,
    [currencies]
  );

  const setDisplayCurrencyCode = useCallback((code: string | null) => {
    if (code) {
      localStorage.setItem("currency-display-code", code);
    } else {
      localStorage.removeItem("currency-display-code");
    }
    setDisplayCurrencyCodeState(code);
  }, []);

  const setDisplayMode = useCallback((mode: CurrencyDisplayMode) => {
    localStorage.setItem("currency-display-mode", mode);
    setDisplayModeState(mode);
  }, []);

  const getLatestRate = useCallback(
    async (toCurrency: string) => {
      if (!baseCurrency || toCurrency === baseCurrency.code) return "1";
      return currencyService.getLatestExchangeRate(baseCurrency.code, toCurrency);
    },
    [baseCurrency]
  );

  const updateRate = useCallback((currencyCode: string, rate: string) => {
    setTodayStatus((prev) =>
      prev.map((s) =>
        s.currency_code === currencyCode ? { ...s, rate, has_rate_today: true } : s
      )
    );
  }, []);

  const setRateForToday = useCallback(
    async ({
      toCurrency,
      rate,
      rateType = "Middle",
      source = "Manual",
    }: {
      toCurrency: string;
      rate: string;
      rateType?: string;
      source?: string;
    }) => {
      if (!baseCurrency) return;
      await currencyService.setExchangeRate({
        from_currency: baseCurrency.code,
        to_currency: toCurrency,
        rate,
        rate_type: rateType,
        source,
      });
      await load();
    },
    [baseCurrency, load]
  );

  const rateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const status of todayStatus) {
      const value = Number.parseFloat(status.rate ?? status.last_rate ?? "0");
      if (Number.isFinite(value) && value > 0) {
        map.set(status.currency_code, value);
      }
    }
    if (import.meta.env.DEV) {
      console.log("[CurrencyProvider] rateMap built:", Object.fromEntries(map));
      console.log("[CurrencyProvider] rateMap raw todayStatus:", todayStatus.map(s => ({
        code: s.currency_code,
        rate: s.rate,
        last_rate: s.last_rate,
        has_rate_today: s.has_rate_today,
      })));
    }
    return map;
  }, [todayStatus]);

  const toBaseFn = useCallback(
    (amount: number, currencyCode: string) => {
      return strategyToBase(amount, currencyCode, rateMap, baseCurrency?.code ?? null);
    },
    [baseCurrency, rateMap]
  );

  const convertFromBase = useCallback(
    (amountInBase: number, targetCurrencyCode: string) => {
      return strategyFromBase(amountInBase, targetCurrencyCode, rateMap, baseCurrency?.code ?? null);
    },
    [baseCurrency, rateMap]
  );

  const convertBetween = useCallback(
    (amount: number, fromCode: string, toCode: string) => {
      return strategyConvertBetween(amount, fromCode, toCode, rateMap, baseCurrency?.code ?? null);
    },
    [baseCurrency, rateMap]
  );

  const hasTodayRate = useCallback(
    (currencyCode: string) => {
      if (!baseCurrency || currencyCode === baseCurrency.code) return true;
      const status = todayStatus.find((s) => s.currency_code === currencyCode);
      return Boolean(status?.has_rate_today);
    },
    [baseCurrency, todayStatus]
  );

  const formatAmount = useCallback(
    (
      amountInBase: number | null | undefined,
      opts?: { currencyCode?: string; withCode?: boolean; hideSymbol?: boolean; mode?: CurrencyDisplayMode | "both" }
    ) => {
      const val = amountInBase ?? 0;
      const mode = opts?.mode || displayMode;

      const renderSingle = (code: string) => {
        const currency = currencies.find((c) => c.code === code) || baseCurrency;
        if (!currency) return formatWithLocale(val, 2);
        const amount = convertFromBase(val, currency.code);
        const formatted = formatWithLocale(amount, currency.decimals);
        const showSymbol = opts?.withCode !== false && opts?.hideSymbol !== true;
        return !showSymbol ? formatted : `${formatted} ${currency.symbol || currency.code}`;
      };

      if (mode === "both" && baseCurrency && displayCurrencyCode && baseCurrency.code !== displayCurrencyCode) {
        return `${renderSingle(baseCurrency.code)} (${renderSingle(displayCurrencyCode)})`;
      }

      const activeCode = opts?.currencyCode || (mode === "base" ? baseCurrency?.code : displayCurrencyCode) || baseCurrency?.code || "";
      if (!activeCode) return formatWithLocale(val, 2);
      return renderSingle(activeCode);
    },
    [displayMode, baseCurrency, displayCurrencyCode, currencies, convertFromBase]
  );

  const formatMonetaryAmount = useCallback(
    (amount: string | number | { base_amount?: string } | null | undefined, mode?: CurrencyDisplayMode | "both") => {
      if (!amount) return formatAmount(0, { mode });
      // If it's a MonetaryAmount V2 DTO
      if (typeof amount === "object" && "base_amount" in amount && amount.base_amount) {
        return formatAmount(parseFloat(amount.base_amount), { mode });
      }
      // Fallback for plain numbers (assumed to be base)
      return formatAmount(parseFloat(amount as string), { mode });
    },
    [formatAmount]
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      loading,
      baseCurrency,
      displayCurrencyCode,
      displayMode,
      currencies,
      hasMultipleCurrencies,
      todayStatus,
      rateMap,
      setDisplayCurrencyCode,
      setDisplayMode,
      refresh: load,
      updateRate,
      setRateForToday,
      getLatestRate,
      toBase: toBaseFn,
      convertFromBase,
      convertBetween,
      formatAmount,
      formatMonetaryAmount,
      hasTodayRate,
    }),
    [
      loading,
      baseCurrency,
      displayCurrencyCode,
      displayMode,
      currencies,
      hasMultipleCurrencies,
      todayStatus,
      rateMap,
      setDisplayCurrencyCode,
      setDisplayMode,
      load,
      updateRate,
      setRateForToday,
      getLatestRate,
      toBaseFn,
      convertFromBase,
      convertBetween,
      formatAmount,
      formatMonetaryAmount,
      hasTodayRate,
    ]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

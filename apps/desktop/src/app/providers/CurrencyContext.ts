import { createContext, useContext, type ReactNode } from "react";
import { type Currency, type TodayRateStatus } from '@modules/core/api/currencyService';

export type CurrencyDisplayMode = "base" | "selected";

export type CurrencyContextValue = {
  loading: boolean;
  baseCurrency: Currency | null;
  displayCurrencyCode: string | null;
  displayMode: CurrencyDisplayMode;
  currencies: Currency[];
  todayStatus: TodayRateStatus[];
  setDisplayCurrencyCode: (code: string) => void;
  setDisplayMode: (mode: CurrencyDisplayMode) => void;
  refresh: () => Promise<void>;
  setRateForToday: (params: { toCurrency: string; rate: string; rateType?: string; source?: string }) => Promise<void>;
  getLatestRate: (toCurrency: string) => Promise<string | null>;
  convertFromBase: (amountInBase: number, targetCurrencyCode: string) => number;
  convertBetween: (amount: number, fromCode: string, toCode: string) => number;
  formatAmount: (amountInBase: number | null | undefined, opts?: { currencyCode?: string; withCode?: boolean; hideSymbol?: boolean; mode?: CurrencyDisplayMode | "both" }) => string;
  formatMonetaryAmount: (amount: string | number | { base_amount?: string } | null | undefined, mode?: CurrencyDisplayMode | "both") => string;
  hasTodayRate: (currencyCode: string) => boolean;
};

export const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function formatWithLocale(amount: number, decimals: number) {
  return new Intl.NumberFormat("ar-SY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.max(0, decimals),
  }).format(amount);
}

export function useCurrencyContext() {
  const value = useContext(CurrencyContext);
  if (!value) {
    throw new Error("useCurrencyContext must be used within CurrencyProvider");
  }
  return value;
}

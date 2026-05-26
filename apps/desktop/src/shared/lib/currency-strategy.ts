/**
 * Centralized currency conversion strategy.
 *
 * Current strategy (single-rate model):
 *   rateMap stores: for each non-base currency, how many units = 1 base currency unit.
 *   e.g. base = USD, rateMap.get("SYP") = 130  =>  1 USD = 130 SYP
 *
 *   toBase(6500 SYP)     = 6500 / 130 = 50 USD    (divide by rate)
 *   fromBase(50 USD, SYP) = 50 * 130  = 6500 SYP   (multiply by rate)
 */

/** Strategy interface — implement this to add a new conversion strategy. */
export interface ICurrencyStrategy {
  /** Check if a currency code is the base currency. */
  isBaseCurrency(code: string, baseCode: string | null | undefined): boolean;

  /** Get exchange rate (1 for base currency, rateMap value otherwise). */
  getExchangeRate(
    code: string,
    rateMap: Map<string, number>,
    baseCode: string | null | undefined,
  ): number;

  /** Convert amount from any currency to base currency. */
  toBase(
    amount: number,
    code: string,
    rateMap: Map<string, number>,
    baseCode: string | null | undefined,
  ): number;

  /** Convert amount from base currency to target currency. */
  fromBase(
    amountInBase: number,
    targetCode: string,
    rateMap: Map<string, number>,
    baseCode: string | null | undefined,
  ): number;

  /** Convert amount between any two currencies (via base as intermediate). */
  convertBetween(
    amount: number,
    fromCode: string,
    toCode: string,
    rateMap: Map<string, number>,
    baseCode: string | null | undefined,
  ): number;

  /**
   * For per-currency table columns: return the original amount if the row's
   * currency matches the column's currency, otherwise return 0.
   */
  fieldForCurrency(
    originalAmount: number | string | null | undefined,
    rowCurrency: string,
    columnCurrency: string,
  ): number;
}

// ───────────────────────────────────────
//  Current single-rate strategy
// ───────────────────────────────────────

export function isBaseCurrency(
  currencyCode: string,
  baseCurrencyCode: string | null | undefined,
): boolean {
  return !!baseCurrencyCode && currencyCode === baseCurrencyCode;
}

export function getExchangeRate(
  currencyCode: string,
  rateMap: Map<string, number>,
  baseCurrencyCode: string | null | undefined,
): number {
  if (isBaseCurrency(currencyCode, baseCurrencyCode)) return 1;
  return rateMap.get(currencyCode) ?? 1;
}

export function toBase(
  amount: number,
  currencyCode: string,
  rateMap: Map<string, number>,
  baseCurrencyCode: string | null | undefined,
): number {
  if (!baseCurrencyCode || isBaseCurrency(currencyCode, baseCurrencyCode)) return amount;
  const rate = rateMap.get(currencyCode);
  if (!rate || rate <= 0) return amount;
  return amount / rate;
}

export function fromBase(
  amountInBase: number,
  targetCurrencyCode: string,
  rateMap: Map<string, number>,
  baseCurrencyCode: string | null | undefined,
): number {
  if (!baseCurrencyCode || isBaseCurrency(targetCurrencyCode, baseCurrencyCode))
    return amountInBase;
  const rate = rateMap.get(targetCurrencyCode);
  if (!rate || rate <= 0) return amountInBase;
  return amountInBase * rate;
}

export function convertBetween(
  amount: number,
  fromCode: string,
  toCode: string,
  rateMap: Map<string, number>,
  baseCurrencyCode: string | null | undefined,
): number {
  if (fromCode === toCode) return amount;
  const inBase = toBase(amount, fromCode, rateMap, baseCurrencyCode);
  return fromBase(inBase, toCode, rateMap, baseCurrencyCode);
}

export function fieldForCurrency(
  originalAmount: number | string | null | undefined,
  rowCurrency: string,
  columnCurrency: string,
): number {
  if (rowCurrency !== columnCurrency) return 0;
  const amt = typeof originalAmount === "string" ? Number.parseFloat(originalAmount) : (originalAmount ?? 0);
  return Number.isFinite(amt) ? amt : 0;
}

// ───────────────────────────────────────
//  Strategy objects
// ───────────────────────────────────────

/** Current single-rate strategy bundled as an object. */
export const baseCurrencyStrategy: ICurrencyStrategy = {
  isBaseCurrency,
  getExchangeRate,
  toBase,
  fromBase,
  convertBetween,
  fieldForCurrency,
};

/** Default strategy (currently the single-rate model). */
export const defaultStrategy: ICurrencyStrategy = baseCurrencyStrategy;

/**
 * Helper: create a context-bound strategy that bakes in the rateMap and
 * baseCurrencyCode so callers don't need to pass them every time.
 */
export function createBoundStrategy(
  strategy: ICurrencyStrategy,
  rateMap: Map<string, number>,
  baseCurrencyCode: string | null | undefined,
) {
  return {
    toBase: (amount: number, code: string) => strategy.toBase(amount, code, rateMap, baseCurrencyCode),
    fromBase: (amountInBase: number, targetCode: string) => strategy.fromBase(amountInBase, targetCode, rateMap, baseCurrencyCode),
    convertBetween: (amount: number, fromCode: string, toCode: string) => strategy.convertBetween(amount, fromCode, toCode, rateMap, baseCurrencyCode),
    getExchangeRate: (code: string) => strategy.getExchangeRate(code, rateMap, baseCurrencyCode),
    isBaseCurrency: (code: string) => strategy.isBaseCurrency(code, baseCurrencyCode),
    fieldForCurrency: (originalAmount: number | string | null | undefined, rowCurrency: string, columnCurrency: string) =>
      strategy.fieldForCurrency(originalAmount, rowCurrency, columnCurrency),
  };
}

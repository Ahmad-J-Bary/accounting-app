export const getInvoiceBaseAmount = (
  originalAmount: string | number | null | undefined,
  v2Amount?: { base_amount?: string },
  currencyCode?: string,
  exchangeRate?: string,
  baseCurrencyCode?: string | null
): number => {
  if (v2Amount?.base_amount) {
    return parseFloat(v2Amount.base_amount) || 0;
  }
  const amt = typeof originalAmount === "string" ? parseFloat(originalAmount) : (originalAmount ?? 0);
  if (!amt) return 0;
  if (currencyCode && baseCurrencyCode && currencyCode === baseCurrencyCode) {
    return amt;
  }
  const rate = parseFloat(exchangeRate || "1") || 1;
  return amt / rate;
};

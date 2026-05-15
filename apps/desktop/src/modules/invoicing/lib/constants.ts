export const CURRENCY_SYMBOLS: Record<string, string> = {
  "USD": "$", "SYP": "ل.س", "EUR": "€", "TRY": "₺",
};

export const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  Draft:         { label: "مسودة",        color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  Saved:         { label: "محفوظ",        color: "text-blue-700",  bg: "bg-blue-50 border-blue-200" },
  Posted:        { label: "مرحّل",        color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  Cancelled:     { label: "ملغي",         color: "text-red-700",    bg: "bg-red-50 border-red-200" },
  PartiallyPaid: { label: "مدفوع جزئياً", color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  FullyPaid:     { label: "مدفوع بالكامل", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
};

export const PAYMENT_METHOD_MAP: Record<string, string> = {
  "cash": "Cash",
  "credit": "Deferred",
  "partial": "Partial",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقداً",
  credit: "آجل",
  partial: "جزئي",
};

export const CASH_CUSTOMER_NAME = "زبون نقدي";
export const CASH_SUPPLIER_NAME = "مورد نقدي";

export function resolveCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] || code;
}

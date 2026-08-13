import { parseSafeNumber } from "@shared/lib/parseSafeNumber";

let _numberingSystem: "arab" | "latn" = "latn";

export function getNumberingSystem(): "arab" | "latn" {
  return _numberingSystem;
}

export function setNumberingSystem(system: string) {
  _numberingSystem = system === "western" ? "latn" : "arab";
}

export const formatCurrency = (
  amount: number,
  currency?: string | null,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string => {
  const formatted = new Intl.NumberFormat("ar-SY", {
    numberingSystem: _numberingSystem,
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(amount);
  return currency ? `${formatted} ${currency}` : formatted;
};

export const formatNumber = (n: number): string => {
  return new Intl.NumberFormat("ar-SY", {
    numberingSystem: _numberingSystem,
  }).format(n);
};

export const formatDate = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-SY", {
    numberingSystem: _numberingSystem,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  let formatted = new Intl.DateTimeFormat("ar-SY", {
    numberingSystem: _numberingSystem,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  if (_numberingSystem === "latn") {
    formatted = formatted.replace(/\s*ص/, " AM").replace(/\s*م/, " PM");
  }
  return formatted;
};

export function toLocalString(n: number): string {
  return new Intl.NumberFormat("ar-SY", {
    numberingSystem: _numberingSystem,
  }).format(n);
}

/** Local calendar date (YYYY-MM-DD) for a Date, independent of the UTC timezone. */
export function toLocalDatePart(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local calendar date (YYYY-MM-DD) of an ISO/timestamp string. Falls back to the input on invalid dates. */
export function toLocalDateStr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return toLocalDatePart(d);
}

/**
 * Converts a picked local date (YYYY-MM-DD) into the matching UTC instant,
 * so server-side filters match what the user sees in local time.
 *   from_date (start of day)  -> new Date("YYYY-MM-DDT00:00:00").toISOString()
 *   to_date   (end of day)    -> new Date("YYYY-MM-DDT23:59:59.999").toISOString()
 */
export function toUtcBound(date: string, endOfDay: boolean): string {
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00";
  return new Date(`${date}${suffix}`).toISOString();
}

export function toFixed(n: number, digits: number): string {
  return new Intl.NumberFormat("ar-SY", {
    numberingSystem: _numberingSystem,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/**
 * Formats a money value coming from the backend (string-encoded decimal) or a
 * local number/input. Null/undefined/NaN collapse to "0.00" so callers don't
 * sprinkle `parseFloat(x || "0")` everywhere.
 */
export function fmtMoney(value: string | number | null | undefined, digits = 2): string {
  const parsed = parseSafeNumber(value);
  return new Intl.NumberFormat("ar-SY", {
    numberingSystem: _numberingSystem,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(parsed);
}

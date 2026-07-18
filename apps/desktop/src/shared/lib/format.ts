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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-SY", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
};

export function toLocalString(n: number): string {
  return new Intl.NumberFormat("ar-SY", {
    numberingSystem: _numberingSystem,
  }).format(n);
}

export function toFixed(n: number, digits: number): string {
  return new Intl.NumberFormat("ar-SY", {
    numberingSystem: _numberingSystem,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}
